/**
 * GMAT Logger Side Panel - Authentication Module
 * Handles token management, login flow, and authenticated API requests.
 */

import { baseUrl } from './utils.js';

// Constants
const TOKEN_KEY = 'gmat_auth_token';
const EXPIRY_KEY = 'gmat_auth_expires';
const USER_KEY = 'gmat_user_id';

/**
 * Check if the user has a valid authentication token
 * @returns {boolean} True if token exists and is not expired
 */
export function hasValidToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = localStorage.getItem(EXPIRY_KEY);

    if (!token || !expiresAt) return false;

    // Check expiration with a 5-minute buffer
    const expiryTime = new Date(expiresAt).getTime();

    // If expiry is invalid, assume token might be valid and let server decide
    if (isNaN(expiryTime)) {
        return true;
    }

    const now = Date.now();
    const buffer = 10 * 1000; // 10 seconds buffer

    return now < (expiryTime - buffer);
}

/**
 * Get the current authentication token
 * @returns {string|null} The token or null if invalid
 */
export function getToken() {
    if (!hasValidToken()) return null;
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get the current user ID
 * @returns {string|null}
 */
export function getUserId() {
    return localStorage.getItem(USER_KEY);
}

/**
 * Save authentication data to local storage
 * @param {Object} authData
 */
export function saveToken(authData) {
    if (!authData.token || !authData.expiresAt) {
        console.error('Invalid auth data received:', authData);
        return;
    }

    localStorage.setItem(TOKEN_KEY, authData.token);
    localStorage.setItem(EXPIRY_KEY, authData.expiresAt);

    if (authData.userId) {
        localStorage.setItem(USER_KEY, authData.userId);
    }
}

/**
 * Clear authentication data (Logout)
 */
export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);
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

        // Handler for receiving the token
        const messageHandler = (event) => {
            // CRITICAL: Validate origin for security
            // We only accept messages from our own API domain
            if (event.origin !== baseUrl) {
                // Ignoring messages from other origins
                return;
            }

            if (event.data && event.data.type === 'AUTH_TOKEN') {
                // Save the received token
                saveToken(event.data);

                // Close the popup
                if (authWindow && !authWindow.closed) {
                    authWindow.close();
                }

                // cleanup
                window.removeEventListener('message', messageHandler);
                resolve(true);
            }
        };

        window.addEventListener('message', messageHandler);

        // Safety timeout - stop waiting after 5 minutes
        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            if (authWindow && !authWindow.closed) {
                // We don't close it automatically on timeout as user might be slow typing password
                // but we stop listening
            }
            // If we haven't resolved yet, we can assume it didn't complete immediately
            // But we don't necessarily resolve(false) here because the user might still be interacting.
            // The promise might hang if user abandons it, which is acceptable for this flow.
        }, 300000);

        // Optional: Poll to see if window was closed manually without sending token
        const pollTimer = setInterval(() => {
            if (authWindow.closed) {
                clearInterval(pollTimer);
                // If window is closed and we have a token, it was handled by messageHandler.
                // If no token, then user closed it without logging in.
                if (!hasValidToken()) {
                    window.removeEventListener('message', messageHandler);
                    resolve(false);
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
    const token = getToken();

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
        // Note: We don't auto-clear token here because some endpoints (like GET /tags) 
        // are incorrectly returning 401 even with valid tokens.
        // We let the UI handle the error message instead.
        const error = new Error('Session expired');
        error.code = 'AUTH_EXPIRED';
        throw error;
    }

    return response;
}
