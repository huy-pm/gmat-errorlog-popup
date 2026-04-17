export interface AuthProvider {
    authenticatedFetch: (url: string, options?: any) => Promise<Response>;
    hasValidToken: () => boolean | Promise<boolean>;
    authenticate: () => Promise<boolean>;
    clearToken: () => void;
    getToken: () => string | null | Promise<string | null>;
}
export declare const setAuthProvider: (p: AuthProvider) => void;
export declare const authenticatedFetch: (url: string, options?: any) => Promise<Response>;
export declare const hasValidToken: () => Promise<boolean>;
export declare const authenticate: () => Promise<boolean>;
export declare const clearToken: () => void;
export declare const getToken: () => Promise<string | null>;
