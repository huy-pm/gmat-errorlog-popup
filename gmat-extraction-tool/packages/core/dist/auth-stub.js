// Default implementation (stub)
let provider = {
    authenticatedFetch: async (url, options) => {
        console.warn('Auth provider not configured, using fetch');
        return fetch(url, options);
    },
    hasValidToken: () => false,
    authenticate: async () => false,
    clearToken: () => { },
    getToken: () => null
};
export const setAuthProvider = (p) => {
    provider = p;
};
// Exports that delegate to the provider
export const authenticatedFetch = (url, options) => provider.authenticatedFetch(url, options);
export const hasValidToken = async () => Promise.resolve(provider.hasValidToken());
export const authenticate = () => provider.authenticate();
export const clearToken = () => provider.clearToken();
export const getToken = async () => Promise.resolve(provider.getToken());
//# sourceMappingURL=auth-stub.js.map