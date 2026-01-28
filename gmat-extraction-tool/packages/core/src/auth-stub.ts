
export interface AuthProvider {
    authenticatedFetch: (url: string, options?: any) => Promise<Response>;
    hasValidToken: () => boolean | Promise<boolean>;
    authenticate: () => Promise<boolean>;
    clearToken: () => void;
    getToken: () => string | null | Promise<string | null>;
}

// Default implementation (stub)
let provider: AuthProvider = {
    authenticatedFetch: async (url, options) => {
        console.warn('Auth provider not configured, using fetch');
        return fetch(url, options);
    },
    hasValidToken: () => false,
    authenticate: async () => false,
    clearToken: () => { },
    getToken: () => null
};

export const setAuthProvider = (p: AuthProvider) => {
    provider = p;
};

// Exports that delegate to the provider
export const authenticatedFetch = (url: string, options?: any) => provider.authenticatedFetch(url, options);
export const hasValidToken = async () => Promise.resolve(provider.hasValidToken());
export const authenticate = () => provider.authenticate();
export const clearToken = () => provider.clearToken();
export const getToken = async () => Promise.resolve(provider.getToken());
