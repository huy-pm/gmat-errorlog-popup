
import {
    createSidebar,
    setAuthProvider,
    setQuestionExtractor,
    getExtractor,
    detectQuestionSource,
    CONFIG,
    baseUrl
} from '@gmat-extraction/core';

// Bridge to Background Service Worker for Auth
const ExtensionAuth = {
    async getToken() {
        return new Promise<string | null>((resolve) => {
            chrome.runtime.sendMessage({ action: 'GET_TOKEN', interactive: false }, (response) => {
                resolve(response.token || null);
            });
        });
    },

    async authenticate() {
        return new Promise<boolean>((resolve) => {
            // First try to get token from storage
            chrome.runtime.sendMessage({ action: 'GET_TOKEN', interactive: false }, (response) => {
                if (response.token) {
                    resolve(true);
                    return;
                }

                // If no token, launch popup flow (similar to bookmarklet)
                const authUrl = `${baseUrl}/auth/external?source=extension`;

                const width = 500;
                const height = 600;
                const left = (window.screen.width / 2) - (width / 2);
                const top = (window.screen.height / 2) - (height / 2);

                const authWindow = window.open(authUrl, 'GMATAuthPopup', `width=${width},height=${height},left=${left},top=${top}`);

                if (!authWindow) {
                    alert('Popup blocked! Please allow popups for authentication.');
                    resolve(false);
                    return;
                }

                const messageHandler = (event: MessageEvent) => {
                    // Origin check logic matches bookmarklet
                    if (event.origin !== baseUrl) {
                        console.warn(`[Extension Auth] Origin Mismatch. Expected ${baseUrl}, Got ${event.origin}`);
                        return;
                    }

                    if (event.data && event.data.type === 'AUTH_TOKEN') {
                        console.log('[Extension Auth] Token received, saving...');
                        // Save token to extension storage via background
                        chrome.runtime.sendMessage({
                            action: 'SAVE_TOKEN',
                            token: event.data.token,
                            refreshToken: event.data.refreshToken,
                            expiresAt: event.data.expiresAt
                        }, (saveRes) => {
                            if (authWindow && !authWindow.closed) authWindow.close();
                            window.removeEventListener('message', messageHandler);
                            resolve(true);
                        });
                    }
                };

                window.addEventListener('message', messageHandler);

                // Polling to detect close without success
                const pollTimer = setInterval(() => {
                    if (authWindow.closed) {
                        clearInterval(pollTimer);
                        window.removeEventListener('message', messageHandler);
                        // Double check token existence
                        chrome.runtime.sendMessage({ action: 'GET_TOKEN', interactive: false }, (res) => {
                            resolve(!!res.token);
                        });
                    }
                }, 1000);
            });
        });
    },

    async hasValidToken() {
        const token = await this.getToken();
        return !!token;
    },

    clearToken() {
        chrome.runtime.sendMessage({ action: 'LOGOUT' });
    },

    async authenticatedFetch(url: string, options: any = {}) {
        const token = await this.getToken();
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
};

// Initialize
setAuthProvider(ExtensionAuth);

(async function () {
    console.log('Extensions Content Script Loaded v' + CONFIG.version);

    // Setup Extractor
    const currentUrl = window.location.href;
    const source = detectQuestionSource(currentUrl);
    const extractor = getExtractor(currentUrl);

    if (extractor) {
        setQuestionExtractor(extractor);
        console.log('Extractor configured for:', source);
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'TOGGLE_SIDEBAR') {
            if (!window.__SMARTLOG_INJECTED__) {
                // Sidebar doesn't exist, create it
                createSidebar();
            } else {
                // Sidebar exists, toggle its visibility using transform
                const sidebar = document.getElementById('smartlog-split-container');
                if (sidebar) {
                    const currentTransform = sidebar.style.transform;
                    
                    if (currentTransform === 'translateX(100%)' || currentTransform === '') {
                        // Sidebar is hidden or initial state, show it
                        sidebar.style.transform = 'translateX(0)';
                        document.body.style.marginRight = sidebar.style.width || '400px';
                        const expandBtn = document.getElementById('smartlog-expand-button');
                        if (expandBtn) expandBtn.style.display = 'none';
                    } else {
                        // Sidebar is visible, hide it
                        sidebar.style.transform = 'translateX(100%)';
                        document.body.style.marginRight = '0px';
                        const expandBtn = document.getElementById('smartlog-expand-button');
                        if (expandBtn) expandBtn.style.display = 'block';
                    }
                } else {
                    // Sidebar element not found, recreate it
                    window.__SMARTLOG_INJECTED__ = false;
                    createSidebar();
                }
            }
            sendResponse({ success: true });
        }
        return true; // Keep channel open for async response
    });

})();
