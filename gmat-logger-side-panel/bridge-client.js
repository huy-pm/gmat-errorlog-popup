/**
 * Bridge Client
 * Handles communication with the authentication iframe hosted on the main domain.
 */

import { CONFIG } from './utils.js';

export class AuthBridge {
    constructor() {
        // Use the production URL for the bridge, or make it configurable
        // Using direct CONFIG.apiUrl to ensure we hit the correct domain where auth-bridge.html is hosted
        // If testing locally, this might need to be adjustable, but for now we assume the bridge is on the deployed app
        // or the local equivalent.
        // We defer initialization to init() to allow potentially changing the URL if needed.
        this.iframe = null;
        this.pendingRequests = new Map();
        this.nextRequestId = 1;
        this.isReady = false;

        // Define the bridge URL. 
        // NOTE: This must match where auth-bridge.html is deployed.
        // If running extension on 3rd party, we generally want the production bridge.
        this.bridgeUrl = `${CONFIG.apiUrl}/auth-bridge.html`;

        // For local development overrides
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // If we are developing locally, we might want to point to local bridge
            // this.bridgeUrl = `${CONFIG.devUrl}/auth-bridge.html`;
        }
    }

    /**
     * Initialize the iframe bridge
     */
    init() {
        if (this.iframe && this.isReady) return Promise.resolve();
        // If iframe exists but not ready, we returns a promise that waits? 
        // For simplicity, if iframe exists, we assume we are waiting or ready.
        // But better to track the promise.

        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            this.iframe = document.createElement('iframe');
            this.iframe.style.display = 'none';
            this.iframe.src = this.bridgeUrl;
            this.iframe.id = 'gmat-auth-bridge';

            // Timeout for initialization
            const timeoutId = setTimeout(() => {
                // If it timed out, we still resolve? Or reject?
                // If we reject, the app might think auth failed.
                // Let's log warning and resolve - hoping maybe it works later or just fails gracefully on getToken
                console.warn('[BridgeClient] Bridge init timed out (no ready signal), proceeding anyway');
                this.isReady = true;
                resolve();
            }, 10000); // Wait up to 10s for Clerk to load

            // Handle load event (DOM loaded)
            this.iframe.onload = () => {
                console.log('[BridgeClient] Auth Bridge DOM loaded, waiting for ready signal...');
            };

            this.iframe.onerror = (err) => {
                console.error('Auth Bridge failed to load', err);
                clearTimeout(timeoutId);
                reject(new Error('Failed to load auth bridge'));
            };

            // Setup message listener for READY signal
            const readyHandler = (event) => {
                const bridgeOrigin = new URL(this.bridgeUrl).origin;
                if (event.origin !== bridgeOrigin) return;

                if (event.data.type === 'AUTH_BRIDGE_READY') {
                    console.log('[BridgeClient] Received AUTH_BRIDGE_READY');
                    this.isReady = true;
                    clearTimeout(timeoutId);
                    window.removeEventListener('message', readyHandler); // Remove this specific listener
                    resolve();
                }
            };

            // We need a persistent listener for tokens, but this one is just for Init.
            // Actually, handleMessage is bound in constructor or init? 
            // The class has handleMessage. Let's make sure we don't duplicate listeners.
            // Using a temp one is cleaner for the init logic.
            window.addEventListener('message', readyHandler);

            // Also ensure the main handler is attached if not already
            if (!this.listening) {
                window.addEventListener('message', this.handleMessage.bind(this));
                this.listening = true;
            }

            document.body.appendChild(this.iframe);
        });

        return this.initPromise;
    }

    /**
     * Handle incoming messages from the iframe
     */
    handleMessage(event) {
        // Strict origin check
        const bridgeOrigin = new URL(this.bridgeUrl).origin;
        if (event.origin !== bridgeOrigin) {
            return;
        }

        const { type, payload, requestId, error } = event.data;

        // If the bridge sends back a request ID, use it to map to the specific promise
        if (requestId && this.pendingRequests.has(requestId)) {
            const { resolve, reject } = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            this.processResponse(type, payload, error, resolve, reject);
            return;
        }

        // FALLBACK: The provided auth-bridge.html does NOT echo requestId.
        // We assume strictly sequential requests (FIFO) or just resolve the first pending one.
        // Since auth requests are rare/singleton, resolving the first one is safe enough.
        if (!requestId && this.pendingRequests.size > 0) {
            // Get the first (oldest) pending request
            const firstKey = this.pendingRequests.keys().next().value;
            const { resolve, reject } = this.pendingRequests.get(firstKey);
            this.pendingRequests.delete(firstKey);
            this.processResponse(type, payload, error, resolve, reject);
        }
    }

    processResponse(type, payload, error, resolve, reject) {
        if (type === 'TOKEN_SUCCESS') {
            resolve(payload.token);
        } else if (type === 'TOKEN_ERROR') {
            reject(new Error(error || 'Token retrieval failed'));
        } else if (type === 'AUTH_BRIDGE_READY') {
            // Bridge is loaded, we could potentially resolve an init promise here if we had one separate
            console.log('[BridgeClient] Auth bridge reported ready');
        } else {
            // Unknown response
            console.warn('Unknown response type from bridge', type);
            // We don't reject here because it might be an unrelated message
        }
    }

    /**
     * Request a token from the bridge
     * @returns {Promise<string>} The access token
     */
    getToken() {
        if (!this.iframe) {
            return this.init().then(() => this.sendTokenRequest());
        }
        return this.sendTokenRequest();
    }

    /**
     * Internal method to send the request
     */
    sendTokenRequest() {
        return new Promise((resolve, reject) => {
            if (!this.iframe || !this.iframe.contentWindow) {
                reject(new Error('Bridge iframe not available'));
                return;
            }

            const requestId = this.nextRequestId++;
            this.pendingRequests.set(requestId, { resolve, reject });

            // Set a timeout to reject if no response
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Token request timed out'));
                }
            }, 10000); // 10s timeout

            // Note: We send requestId, but current auth-bridge.html ignores it.
            // Our updated handleMessage will cope with that.
            this.iframe.contentWindow.postMessage({
                type: 'GET_TOKEN',
                requestId
            }, new URL(this.bridgeUrl).origin);
        });
    }
}
