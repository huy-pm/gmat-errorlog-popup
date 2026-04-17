/**
 * Category Registry - Stores and retrieves discovered GMAT Hero categories
 */

import type { CategoryDefinition } from './types';

const STORAGE_KEY = 'batchCategories';

/**
 * Save discovered categories to chrome.storage.local
 */
export async function saveCategories(categories: CategoryDefinition[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: categories });
}

/**
 * Load saved categories from chrome.storage.local
 */
export async function loadCategories(): Promise<CategoryDefinition[]> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
}

/**
 * Get a filtered queue of categories to scrape
 */
export async function getCategoryQueue(filter?: string[]): Promise<CategoryDefinition[]> {
    const all = await loadCategories();
    if (!filter || filter.length === 0) return all;
    return all.filter(c => filter.includes(c.id));
}

/**
 * Clear saved categories
 */
export async function clearCategories(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
}
