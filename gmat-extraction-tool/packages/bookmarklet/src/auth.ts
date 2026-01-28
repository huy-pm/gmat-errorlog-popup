
import { baseUrl } from '@gmat-extraction/core';
// If baseUrl isn't exported from core properly (it is from dom.ts), we use it.

const TOKEN_KEY = 'gmat_auth_token';
const EXPIRY_KEY = 'gmat_auth_expires';
const USER_KEY = 'gmat_user_id';

export function hasValidToken(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = localStorage.getItem(EXPIRY_KEY);
    if (!token || !expiresAt) return false;
    const expiryTime = new Date(expiresAt).getTime();
    if (isNaN(expiryTime)) return true;
    const now = Date.now();
    const buffer = 10 * 1000;
    return now < (expiryTime - buffer);
}

export function getToken(): string | null {
    if (!hasValidToken()) return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(authData: any) {
    if (!authData.token || !authData.expiresAt) return;
    localStorage.setItem(TOKEN_KEY, authData.token);
    localStorage.setItem(EXPIRY_KEY, authData.expiresAt);
    if (authData.userId) localStorage.setItem(USER_KEY, authData.userId);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);
}

export async function authenticate(): Promise<boolean> {
    return new Promise((resolve) => {
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const authUrl = `${baseUrl}/auth/external?source=bookmarklet`;
        const authWindow = window.open(authUrl, 'GMATAuthPopup', `width=${width},height=${height},left=${left},top=${top}`);

        if (!authWindow) {
            alert('Popup blocked! Please allow popups.');
            resolve(false);
            return;
        }

        const messageHandler = (event: MessageEvent) => {
            if (event.origin !== baseUrl) return;
            if (event.data && event.data.type === 'AUTH_TOKEN') {
                saveToken(event.data);
                if (authWindow && !authWindow.closed) authWindow.close();
                window.removeEventListener('message', messageHandler);
                resolve(true);
            }
        };

        window.addEventListener('message', messageHandler);

        const pollTimer = setInterval(() => {
            if (authWindow.closed) {
                clearInterval(pollTimer);
                if (!hasValidToken()) {
                    window.removeEventListener('message', messageHandler);
                    resolve(false);
                }
            }
        }, 1000);
    });
}

export async function authenticatedFetch(url: string, options: any = {}): Promise<Response> {
    const token = getToken();
    if (!token) {
        const error = new Error('Authentication required');
        (error as any).code = 'AUTH_REQUIRED';
        throw error;
    }
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        const error = new Error('Session expired');
        (error as any).code = 'AUTH_EXPIRED';
        throw error;
    }
    return response;
}
