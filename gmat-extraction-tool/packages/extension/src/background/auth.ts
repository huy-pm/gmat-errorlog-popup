// Auth utilities using chrome.storage with token refresh support

const API_BASE_URL = 'http://localhost:5001'; // or process.env.API_URL

interface TokenData {
    token: string;
    refreshToken?: string;
    expiresAt?: number;
}

export async function getAuthToken(interactive: boolean = false): Promise<string> {
    return new Promise(async (resolve, reject) => {
        chrome.storage.local.get(['gmat_auth_token', 'gmat_refresh_token', 'gmat_token_expires'], async (result) => {
            const token = result.gmat_auth_token;
            const refreshToken = result.gmat_refresh_token;
            const expiresAt = result.gmat_token_expires;

            // If no token, reject
            if (!token) {
                reject(new Error('No token found'));
                return;
            }

            // Check if token is expired or about to expire (within 5 minutes)
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;
            
            if (expiresAt && now >= (expiresAt - fiveMinutes)) {
                console.log('[Extension Auth] Token expired or expiring soon, attempting refresh...');
                
                // Try to refresh token
                if (refreshToken) {
                    try {
                        const newTokenData = await refreshAuthToken(refreshToken);
                        if (newTokenData) {
                            await setAuthToken(newTokenData.token, newTokenData.refreshToken, newTokenData.expiresAt);
                            resolve(newTokenData.token);
                            return;
                        }
                    } catch (error) {
                        console.error('[Extension Auth] Token refresh failed:', error);
                        // Clear invalid tokens
                        await removeCachedAuthToken(token);
                        reject(new Error('Token refresh failed'));
                        return;
                    }
                }
                
                // No refresh token or refresh failed
                console.warn('[Extension Auth] No refresh token available');
                reject(new Error('Token expired'));
                return;
            }

            // Token is valid
            resolve(token);
        });
    });
}

export async function refreshAuthToken(refreshToken: string): Promise<TokenData | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) {
            throw new Error(`Refresh failed: ${response.status}`);
        }

        const data = await response.json();
        return {
            token: data.token || data.accessToken,
            refreshToken: data.refreshToken || refreshToken,
            expiresAt: data.expiresAt || (Date.now() + (data.expiresIn * 1000)) || (Date.now() + 3600000) // 1 hour default
        };
    } catch (error) {
        console.error('[Extension Auth] Refresh token error:', error);
        return null;
    }
}

export async function setAuthToken(token: string, refreshToken?: string, expiresAt?: number): Promise<void> {
    return new Promise((resolve) => {
        const data: any = { 
            gmat_auth_token: token
        };
        
        if (refreshToken) {
            data.gmat_refresh_token = refreshToken;
        }
        
        if (expiresAt) {
            data.gmat_token_expires = expiresAt;
        } else {
            // Default: 1 hour from now
            data.gmat_token_expires = Date.now() + (60 * 60 * 1000);
        }
        
        chrome.storage.local.set(data, () => {
            console.log('[Extension Auth] Token saved with expiry:', new Date(data.gmat_token_expires));
            resolve();
        });
    });
}

export async function removeCachedAuthToken(token: string): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['gmat_auth_token', 'gmat_refresh_token', 'gmat_token_expires'], () => {
            console.log('[Extension Auth] Tokens cleared');
            resolve();
        });
    });
}
