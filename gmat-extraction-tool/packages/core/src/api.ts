
import { baseUrl } from './utils/dom.js';
import { authenticatedFetch } from './auth-stub.js'; // Will be replaced by injection or proper auth module

// Simple Cache Helpers
async function getCached(key: string): Promise<any | null> {
    const NOW = Date.now();
    const TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Try Valid Extension Storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                const item = result[key];
                if (item && item.timestamp && (NOW - item.timestamp < TTL)) {
                    resolve(item.data);
                } else {
                    resolve(null);
                }
            });
        });
    }

    // Optional: Fallback to localStorage for bookmarklet?
    // User specifically asked for extension storage, implying bookmarklet behavior is fine as is (or maybe wanted change there too?)
    // "instead thrid website as current bookmarklet does" implies bookmarklet fetches from website.
    // Let's stick to extension storage for now to be safe and "change extension".
    return null;
}

async function setCached(key: string, data: any): Promise<void> {
    const cacheItem = {
        data: data,
        timestamp: Date.now()
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
            const obj = { [key]: cacheItem };
            chrome.storage.local.set(obj, () => resolve());
        });
    }
}

export async function fetchCategories(): Promise<any> {
    const cached = await getCached('gmat_categories');
    if (cached) return cached;

    const response = await authenticatedFetch(`${baseUrl}/api/categories`);
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            const error = new Error('Authentication required');
            (error as any).code = 'AUTH_REQUIRED';
            throw error;
        }
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    await setCached('gmat_categories', data);
    return data;
}

export async function fetchTags(): Promise<any> {
    const cached = await getCached('gmat_tags');
    if (cached) return cached;

    const response = await authenticatedFetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            const error = new Error('Authentication required');
            (error as any).code = 'AUTH_REQUIRED';
            throw error;
        }
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    await setCached('gmat_tags', data);
    return data;
}

export async function submitLog(payload: any): Promise<any> {
    const response = await authenticatedFetch(`${baseUrl}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            const error = new Error('Authentication required');
            (error as any).code = 'AUTH_REQUIRED';
            throw error;
        }
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    return await response.json();
}
