/**
 * Batch Orchestrator - Background Service Worker
 *
 * Coordinates parallel batch scraping across multiple GMAT Hero category pages.
 * Opens N worker tabs, assigns categories from a shared queue, collects results.
 * Persists state in chrome.storage.local to survive service worker restarts.
 */

import { validateBatch } from './validator';
import type {
    BatchState,
    CategoryDefinition,
    ExtractedQuestion,
    BatchError,
    TabWorker
} from './types';

const BATCH_STATE_KEY = 'batchState';
const DELAY_BETWEEN_ASSIGNS_MS = 1500;

function createInitialState(): BatchState {
    return {
        status: 'idle',
        queue: [],
        workers: [],
        concurrency: 3,
        totalCategories: 0,
        results: {},
        errors: [],
        startedAt: null,
        stats: { totalCategories: 0, completedCategories: 0, totalQuestions: 0, totalErrors: 0, skippedQuestions: 0 },
        incorrectOnly: false,
        originTabId: null
    };
}

let batchState: BatchState = createInitialState();

// Tab load listeners (tracked so we can remove them)
const tabLoadCallbacks = new Map<number, () => void>();

async function persistState(): Promise<void> {
    await chrome.storage.local.set({ [BATCH_STATE_KEY]: batchState });
}

export async function loadState(): Promise<BatchState> {
    const result = await chrome.storage.local.get(BATCH_STATE_KEY);
    if (result[BATCH_STATE_KEY]) {
        batchState = result[BATCH_STATE_KEY];
    }
    return batchState;
}

// ============================================
// Start Batch
// ============================================
export async function startBatch(
    categories: CategoryDefinition[],
    incorrectOnly: boolean,
    concurrency: number,
    originTabId: number
): Promise<void> {
    batchState = createInitialState();
    batchState.status = 'running';
    batchState.queue = [...categories];
    batchState.totalCategories = categories.length;
    batchState.stats.totalCategories = categories.length;
    batchState.startedAt = new Date().toISOString();
    batchState.incorrectOnly = incorrectOnly;
    batchState.concurrency = Math.min(concurrency, 5);
    batchState.originTabId = originTabId;

    await persistState();

    console.log(`[Orchestrator] Starting batch: ${categories.length} categories, ${batchState.concurrency} parallel tabs`);

    // Set up tab load listener
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    // Create worker tabs
    const numWorkers = Math.min(batchState.concurrency, batchState.queue.length);
    for (let i = 0; i < numWorkers; i++) {
        const category = batchState.queue.shift()!;
        try {
            const tab = await chrome.tabs.create({
                url: category.url,
                active: false
            });

            const worker: TabWorker = {
                tabId: tab.id!,
                categoryId: category.id,
                categoryName: category.name,
                status: 'navigating',
                questionsExtracted: 0,
                currentQuestionIndex: 0
            };
            batchState.workers.push(worker);

            // When tab finishes loading, send scrape command
            tabLoadCallbacks.set(tab.id!, () => {
                sendScrapeCommand(tab.id!, category.id);
            });
        } catch (err) {
            console.error(`[Orchestrator] Failed to create worker tab:`, err);
            batchState.queue.unshift(category); // Put it back
        }
    }

    await persistState();
    broadcastProgress();
}

// ============================================
// Stop Batch
// ============================================
export async function stopBatch(): Promise<BatchState> {
    batchState.status = 'complete';

    // Tell all worker tabs to stop
    for (const worker of batchState.workers) {
        try {
            await chrome.tabs.sendMessage(worker.tabId, { action: 'BATCH_STOP' });
        } catch { /* tab may be closed */ }
    }

    await finalizeBatch();
    return batchState;
}

// ============================================
// Tab Load Detection
// ============================================
function onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
    if (changeInfo.status === 'complete' && tabLoadCallbacks.has(tabId)) {
        const callback = tabLoadCallbacks.get(tabId)!;
        tabLoadCallbacks.delete(tabId);

        // Small delay to ensure content script is injected and ready
        setTimeout(callback, 500);
    }
}

// ============================================
// Send Scrape Command to a Worker Tab
// ============================================
function sendScrapeCommand(tabId: number, categoryId: string) {
    const worker = batchState.workers.find(w => w.tabId === tabId);
    if (worker) {
        worker.status = 'scraping';
        worker.questionsExtracted = 0;
        worker.currentQuestionIndex = 0;
    }
    broadcastProgress();

    chrome.tabs.sendMessage(tabId, {
        action: 'BATCH_SCRAPE_PAGE',
        categoryId,
        incorrectOnly: batchState.incorrectOnly
    }).catch(err => {
        console.error(`[Orchestrator] Failed to send scrape command to tab ${tabId}:`, err);
        // Retry after a short delay (content script might not be ready yet)
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
                action: 'BATCH_SCRAPE_PAGE',
                categoryId,
                incorrectOnly: batchState.incorrectOnly
            }).catch(retryErr => {
                console.error(`[Orchestrator] Retry failed for tab ${tabId}:`, retryErr);
                onCategoryError(tabId, categoryId, `Content script not responding: ${retryErr.message}`);
            });
        }, 2000);
    });
}

// ============================================
// Assign Next Category to a Worker Tab
// ============================================
async function assignNextCategory(tabId: number): Promise<void> {
    if (batchState.status !== 'running') return;

    if (batchState.queue.length === 0) {
        // No more work — mark this worker as idle
        const worker = batchState.workers.find(w => w.tabId === tabId);
        if (worker) {
            worker.status = 'idle';
            worker.categoryId = null;
            worker.categoryName = null;
        }

        // Check if ALL workers are idle (batch complete)
        const allIdle = batchState.workers.every(w => w.status === 'idle');
        if (allIdle) {
            await finalizeBatch();
        } else {
            broadcastProgress();
        }
        return;
    }

    // Get next category
    const category = batchState.queue.shift()!;
    const worker = batchState.workers.find(w => w.tabId === tabId);
    if (worker) {
        worker.categoryId = category.id;
        worker.categoryName = category.name;
        worker.status = 'navigating';
        worker.questionsExtracted = 0;
        worker.currentQuestionIndex = 0;
    }

    await persistState();
    broadcastProgress();

    // Small delay before navigating to avoid rate limiting
    await delay(DELAY_BETWEEN_ASSIGNS_MS);

    // Navigate tab to new category URL
    try {
        tabLoadCallbacks.set(tabId, () => {
            sendScrapeCommand(tabId, category.id);
        });
        await chrome.tabs.update(tabId, { url: category.url });
    } catch (err) {
        console.error(`[Orchestrator] Failed to navigate tab ${tabId}:`, err);
        batchState.errors.push({
            categoryId: category.id,
            categoryName: category.name,
            questionIndex: -1,
            questionLink: category.url,
            error: `Navigation failed: ${(err as Error).message}`,
            severity: 'error'
        });
        batchState.stats.totalErrors++;
        batchState.stats.completedCategories++;
        await assignNextCategory(tabId);
    }
}

// ============================================
// Handle Results from a Worker Tab
// ============================================
export async function onCategoryComplete(
    senderTabId: number,
    categoryId: string,
    questions: ExtractedQuestion[],
    errors: BatchError[]
): Promise<void> {
    const worker = batchState.workers.find(w => w.tabId === senderTabId);
    const categoryName = worker?.categoryName || categoryId;

    // Validate
    const report = validateBatch(questions, categoryId, categoryName);

    // Store results
    batchState.results[categoryId] = questions;
    batchState.errors.push(...errors, ...report.errors, ...report.warnings);

    // Update stats
    batchState.stats.completedCategories++;
    batchState.stats.totalQuestions += questions.length;
    batchState.stats.totalErrors += errors.length + report.errors.length;

    await persistState();

    console.log(`[Orchestrator] "${categoryName}" complete: ${questions.length} questions, ${report.errors.length} errors`);

    broadcastProgress();

    // Assign next category to this worker
    await assignNextCategory(senderTabId);
}

// ============================================
// Handle Category Error
// ============================================
export async function onCategoryError(
    senderTabId: number,
    categoryId: string,
    error: string
): Promise<void> {
    const worker = batchState.workers.find(w => w.tabId === senderTabId);
    const categoryName = worker?.categoryName || categoryId;

    batchState.errors.push({
        categoryId,
        categoryName,
        questionIndex: -1,
        questionLink: '',
        error,
        severity: 'error'
    });
    batchState.stats.completedCategories++;
    batchState.stats.totalErrors++;

    await persistState();
    broadcastProgress();

    await assignNextCategory(senderTabId);
}

// ============================================
// Handle Per-Question Progress from Worker
// ============================================
export function onScrapeProgress(
    senderTabId: number,
    categoryId: string,
    questionsCount: number,
    currentIndex: number
): void {
    const worker = batchState.workers.find(w => w.tabId === senderTabId);
    if (worker) {
        worker.questionsExtracted = questionsCount;
        worker.currentQuestionIndex = currentIndex;
    }
    broadcastProgress();
}

// ============================================
// Finalize Batch
// ============================================
async function finalizeBatch(): Promise<void> {
    batchState.status = 'complete';

    // Remove tab load listener
    chrome.tabs.onUpdated.removeListener(onTabUpdated);
    tabLoadCallbacks.clear();

    // Clear storage flags
    await chrome.storage.local.set({
        batchMode: false,
        batchCurrentCategoryId: null,
        batchIncorrectOnly: false
    });

    await persistState();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Collect files to download
    const filesToDownload: { content: string; filename: string }[] = [];

    for (const [categoryId, questions] of Object.entries(batchState.results)) {
        if (questions.length === 0) continue;

        const section = questions[0]?.section || 'mixed';
        const questionType = questions[0]?.category || 'unknown';
        // Use categoryId (e.g. "OG-CR-09", "ADVANCE-CR") for unique filenames
        // instead of questionType (e.g. "CR") which is the same for all CR categories
        const safeCategoryId = categoryId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const filename = `GMAT-HERO/${section}/${safeCategoryId}-${timestamp}.json`;

        filesToDownload.push({
            content: JSON.stringify({
                exportedAt: new Date().toISOString(),
                totalRecords: questions.length,
                source: 'gmat-hero',
                section,
                category: questionType,
                categoryId,
                questions
            }, null, 2),
            filename
        });
    }

    if (batchState.errors.length > 0) {
        filesToDownload.push({
            content: JSON.stringify({
                generatedAt: new Date().toISOString(),
                stats: batchState.stats,
                errors: batchState.errors.filter(e => e.severity === 'error'),
                warnings: batchState.errors.filter(e => e.severity === 'warning')
            }, null, 2),
            filename: `GMAT-HERO/error-report-${timestamp}.json`
        });
    }

    // Close worker tabs
    for (const worker of batchState.workers) {
        try {
            await chrome.tabs.remove(worker.tabId);
        } catch { /* tab may already be closed */ }
    }

    // Download files silently via chrome.downloads API (no Save dialog)
    for (const file of filesToDownload) {
        await downloadFile(file.content, file.filename);
    }

    // Broadcast completion to side panel
    chrome.runtime.sendMessage({
        action: 'BATCH_COMPLETE',
        data: {
            stats: batchState.stats,
            errors: batchState.errors
        }
    }).catch(() => {});

    console.log(`[Orchestrator] Batch complete. ${batchState.stats.totalQuestions} questions, ${batchState.stats.totalErrors} errors across ${batchState.stats.completedCategories} categories.`);
}

// ============================================
// Broadcast Progress to Side Panel
// ============================================
function broadcastProgress(): void {
    chrome.runtime.sendMessage({
        action: 'BATCH_PROGRESS',
        data: {
            workers: batchState.workers,
            stats: batchState.stats,
            queueLength: batchState.queue.length,
            status: batchState.status
        }
    }).catch(() => { /* side panel may not be open */ });
}

// ============================================
// Get Batch Status
// ============================================
export async function getBatchStatus(): Promise<BatchState> {
    await loadState();
    return batchState;
}

// ============================================
// Helpers
// ============================================
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadFile(content: string, filename: string): Promise<void> {
    try {
        const bytes = new TextEncoder().encode(content);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:application/json;base64,${base64}`;
        await chrome.downloads.download({
            url: dataUrl,
            filename,
            saveAs: false,
            conflictAction: 'uniquify'
        });
        // Small delay between downloads to avoid overwhelming Chrome
        await delay(300);
    } catch (err) {
        console.error(`[Orchestrator] Download failed for ${filename}:`, err);
    }
}
