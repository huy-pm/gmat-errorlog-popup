/**
 * GMAT Logger Side Panel - Authentication Module
 * Handles token management via Iframe Bridge, login flow, and authenticated API requests.
 */

import { baseUrl } from './utils.js';
import { AuthBridge } from './bridge-client.js';

// Constants
const USER_KEY = 'gmat_user_id'; // We can still persist User ID if useful, or remove it.

// State (Memory Only)
let accessToken = null;
let tokenExpiresAt = null;
const authBridge = new AuthBridge();
const listeners = [];

/**
 * Initialize Authentication
 * Attempts to silently get a token from the bridge.
 */
export async function initAuth() {
    try {
        console.log('[Auth] Initializing bridge authentication...');
        const token = await authBridge.getToken();
        setToken(token);
        console.log('[Auth] Bridge auth successful');
        return true;
    } catch (error) {
        console.log('[Auth] Bridge auth failed (likely not logged in):', error.message);
        setToken(null);
        return false;
    }
}

/**
 * Subscribe to authentication state changes
 * @param {Function} callback - Function called with (isAuthenticated) when state changes
 */
export function subscribeAuthChange(callback) {
    listeners.push(callback);
}

/**
 * Notify all listeners of auth state change
 */
function notifyListeners() {
    const isAuthenticated = hasValidToken();
    listeners.forEach(callback => callback(isAuthenticated));
}

/**
 * Check if we have a valid token in memory
 * @returns {boolean} True if token exists
 */
export function hasValidToken() {
    return !!accessToken;
}

/**
 * Get the current authentication token
 * If cached token is missing or expired (logic pending), tries to fetch from bridge.
 * @returns {Promise<string|null>} The token or null if invalid
 */
export async function getToken() {
    if (accessToken) {
        return accessToken;
    }
    try {
        const token = await authBridge.getToken();
        setToken(token);
        return token;
    } catch (error) {
        return null;
    }
}

/**
 * Set the token in memory and notify listeners
 */
function setToken(token) {
    const changed = accessToken !== token;
    accessToken = token;
    if (changed) {
        notifyListeners();
    }
}

/**
 * Get the current user ID
 * @returns {string|null}
 */
export function getUserId() {
    return localStorage.getItem(USER_KEY);
    // TODO: If needed, we can ask bridge for user info too.
}

/**
 * Clear authentication data (Logout)
 * Note: specific to what "Logout" means here. 
 * If we just clear memory, the bridge might still have a session.
 * Real logout should call bridge to logout? 
 * Or just clear local state.
 */
export function clearToken() {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    // Ideally we might want to tell the bridge to logout too?
    // But usually clearing local state is enough for the client.
}

/**
 * Initiate the authentication flow via popup
 * @returns {Promise<boolean>} Resolves with true if successful, false otherwise
 */
export function authenticate() {
    return new Promise((resolve) => {
        // calculate center position for popup
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        // Open the auth page in the popup
        // This page should handle the actual login (e.g. via Clerk) and postMessage back the token
        const authUrl = `${baseUrl}/auth/external?source=bookmarklet`;

        const authWindow = window.open(
            authUrl,
            'GMATAuthPopup',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!authWindow) {
            alert('Popup blocked! Please allow popups for this site to sign in.');
            resolve(false);
            return;
        }

        // We listen for message from popup primarily to know when it's done.
        // OR we can just poll the bridge?

        // Let's keep the listener as a signal that "Login Complete" happened.
        const messageHandler = async (event) => {
            // CRITICAL: Validate origin for security
            if (event.origin !== baseUrl) {
                return;
            }

            if (event.data && event.data.type === 'AUTH_TOKEN') {
                // The popup sent us a token directly.
                // We can use it, AND we should verify bridge works.
                console.log('[Auth] Received token from popup');

                // Save user ID if present
                if (event.data.userId) {
                    localStorage.setItem(USER_KEY, event.data.userId);
                }

                // We trust the token from popup for immediate use
                setToken(event.data.token);

                // Close the popup
                if (authWindow && !authWindow.closed) {
                    authWindow.close();
                }

                window.removeEventListener('message', messageHandler);
                resolve(true);
            }
        };

        window.addEventListener('message', messageHandler);

        // Safety timeout - stop waiting after 5 minutes
        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
        }, 300000);

        // Poll to see if window was closed
        const pollTimer = setInterval(async () => {
            if (authWindow.closed) {
                clearInterval(pollTimer);
                window.removeEventListener('message', messageHandler);

                // If window closed but we didn't get a message, check bridge
                if (!hasValidToken()) {
                    console.log('[Auth] Popup closed, checking bridge...');
                    const success = await initAuth();
                    resolve(success);
                } else {
                    resolve(true); // Already got token via message
                }
            }
        }, 1000);
    });
}

/**
 * Wrapper for fetch that handles authentication checks and headers
 * @param {string} url 
 * @param {Object} options 
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
    const token = await getToken();

    if (!token) {
        // Throw specific error that UI can catch to trigger login
        const error = new Error('Authentication required');
        error.code = 'AUTH_REQUIRED';
        throw error;
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Handle 401 Unauthorized (Token expired/revoked)
    if (response.status === 401) {
        // Token might be expired. 
        // We could try ONE retry with a fresh token from bridge?
        // simple retry logic:
        if (!options._retry) {
            console.log('[Auth] 401, retrying with fresh token...');
            // Force refresh from bridge? 
            // getToken() checks memory first. We should invalidate memory.
            setToken(null);
            const newToken = await getToken();
            if (newToken) {
                return authenticatedFetch(url, { ...options, _retry: true });
            }
        }

        const error = new Error('Session expired');
        error.code = 'AUTH_EXPIRED';
        throw error;
    }

    return response;
}
