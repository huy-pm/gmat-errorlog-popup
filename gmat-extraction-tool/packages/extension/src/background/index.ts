
import { getAuthToken, removeCachedAuthToken } from './auth';

// Alarm to keep SW alive or refresh token
chrome.alarms.create('keepAlive', { periodInMinutes: 4.9 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
        // Perform token refresh or simple ping
        getAuthToken(false).catch(() => console.log('Keep alive check: No token'));
    }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_TOKEN') {
        getAuthToken(message.interactive)
            .then(token => sendResponse({ token }))
            .catch(err => sendResponse({ error: err.message }));
        return true; // Async response
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
        import('./auth').then(({ setAuthToken }) => {
            setAuthToken(
                message.token, 
                message.refreshToken, 
                message.expiresAt
            ).then(() => {
                sendResponse({ success: true });
            });
        });
        return true;
    }
});

// Handle extension icon click (Toggle Sidebar)
chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_SIDEBAR' }, (response) => {
            // Check for errors (e.g., content script not injected)
            if (chrome.runtime.lastError) {
                console.log('[Extension] Content script not available, injecting...');
                
                // Try to inject the content script manually
                chrome.scripting.executeScript({
                    target: { tabId: tab.id! },
                    files: ['src/content/index.js']
                }).then(() => {
                    // After injection, try sending the message again
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id!, { action: 'TOGGLE_SIDEBAR' });
                    }, 100);
                }).catch(err => {
                    console.error('[Extension] Failed to inject content script:', err);
                    // Show a notification to the user
                    chrome.notifications?.create({
                        type: 'basic',
                        iconUrl: 'icons/icon48.png',
                        title: 'GMAT Logger',
                        message: 'This page is not supported. Please visit GMATClub, GMAT Hero, or GMAT Official Practice.'
                    });
                });
            }
        });
    }
});
