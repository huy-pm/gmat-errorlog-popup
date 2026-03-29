
import { getAuthToken, removeCachedAuthToken, setAuthToken } from './auth';
import {
    startBatch,
    stopBatch,
    onCategoryComplete,
    onCategoryError,
    onScrapeProgress,
    getBatchStatus
} from '../batch/orchestrator';

// Alarm to keep SW alive or refresh token
chrome.alarms.create('keepAlive', { periodInMinutes: 4.9 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
        getAuthToken(false).catch(() => console.log('Keep alive check: No token'));
    }
});

// ============================================
// Side Panel: open on extension icon click
// ============================================
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ============================================
// Message Handlers
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // --- Auth ---
    if (message.action === 'GET_TOKEN') {
        getAuthToken(message.interactive)
            .then(token => sendResponse({ token }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (message.action === 'LOGOUT') {
        getAuthToken(false).then(token => {
            removeCachedAuthToken(token).then(() => {
                sendResponse({ success: true });
            });
        }).catch(() => sendResponse({ success: false }));
        return true;
    }

    if (message.action === 'SAVE_TOKEN') {
        setAuthToken(
            message.token,
            message.refreshToken,
            message.expiresAt
        ).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    // --- Batch Scraping ---

    if (message.action === 'BATCH_START') {
        const concurrency = message.concurrency || 3;
        // originTabId: the tab that has the GMAT Hero page (for downloads)
        // For side panel, we find the active GMAT Hero tab
        const originTabId = sender.tab?.id || 0;

        // If message came from side panel (no sender.tab), find a GMAT Hero tab
        if (!sender.tab) {
            chrome.tabs.query({ url: '*://gmat-hero-v2.web.app/*' }, (tabs) => {
                const tabId = tabs[0]?.id || 0;
                startBatch(message.categories, message.incorrectOnly, concurrency, tabId)
                    .then(() => sendResponse({ success: true }))
                    .catch(err => sendResponse({ error: err.message }));
            });
        } else {
            startBatch(message.categories, message.incorrectOnly, concurrency, originTabId)
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ error: err.message }));
        }
        return true;
    }

    if (message.action === 'BATCH_STOP') {
        stopBatch()
            .then(state => sendResponse({ success: true, state }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (message.action === 'BATCH_STATUS') {
        getBatchStatus()
            .then(state => sendResponse({ state }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (message.action === 'BATCH_QUESTIONS_RECEIVED') {
        const senderTabId = sender.tab?.id || 0;
        onCategoryComplete(senderTabId, message.categoryId, message.questions, message.errors)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (message.action === 'BATCH_CATEGORY_ERROR') {
        const senderTabId = sender.tab?.id || 0;
        onCategoryError(senderTabId, message.categoryId, message.error)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (message.action === 'BATCH_SCRAPE_PROGRESS') {
        const senderTabId = sender.tab?.id || 0;
        onScrapeProgress(senderTabId, message.categoryId, message.questionsCount, message.currentIndex);
        return false;
    }

    if (message.action === 'EXTRACT_GMAT_CLUB_LINK') {
        const tabId = sender.tab?.id;
        if (!tabId) { sendResponse({ url: null }); return false; }

        // Run in the page's JS context (world: 'MAIN') so window.open override
        // actually affects Angular's handler, not the isolated content script window.
        chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => {
                const divs = document.querySelectorAll('.gmat-sub-footer .pointer.disable-select.sub');
                let btn: HTMLElement | null = null;
                for (const div of divs) {
                    if ((div as HTMLElement).textContent?.trim().includes('GMAT Club')) {
                        btn = div as HTMLElement;
                        break;
                    }
                }
                if (!btn) return null;

                let captured: string | null = null;
                const orig = window.open.bind(window);
                window.open = function (url?: string | URL | undefined) {
                    if (url) captured = url.toString();
                    return null;
                } as typeof window.open;

                btn.click();
                window.open = orig;
                return captured;
            }
        }).then((results) => {
            const url = results?.[0]?.result ?? null;
            sendResponse({ url });
        }).catch((err) => {
            console.warn('[Background] EXTRACT_GMAT_CLUB_LINK failed:', err.message);
            sendResponse({ url: null });
        });
        return true; // async response
    }
});
