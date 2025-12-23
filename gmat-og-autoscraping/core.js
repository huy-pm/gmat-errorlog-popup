/**
 * GMAT OG Autoscraping - Core Module
 * Manages the extraction process, navigation, and UI
 */

import {
    detectQuestionType,
    delay,
    isOnListPage,
    isOnQuestionPage,
    getQuestionRows,
    getReviewLink,
    extractDifficultyFromRow,
    hasNextPage,
    clickNextPage,
    getPaginationInfo,
    getCurrentPageFromPagination,
    clickDoneReviewing
} from './utils.js';

// Dynamic extractor imports
const extractors = {};

// State management
let state = {
    extractedQuestions: [],
    isRunning: false,
    startTime: null,
    currentQuestionIndex: 0,
    currentDifficulty: '',
    totalProcessed: 0,
    failedCount: 0,
    currentPageNumber: 1,
    popup: null
};

// ============================================
// EXTRACTOR LOADING
// ============================================

async function loadExtractor(type) {
    if (extractors[type]) {
        return extractors[type];
    }

    try {
        const basePath = getBasePath();
        const module = await import(`${basePath}extractors/di-${type.toLowerCase()}.js`);
        extractors[type] = module;
        return module;
    } catch (error) {
        console.error(`Failed to load extractor for ${type}:`, error);
        return null;
    }
}

function getBasePath() {
    // Get base path from script URL or default to GitHub Pages
    const scripts = document.querySelectorAll('script[src*="gmat-og-autoscraping"]');
    if (scripts.length > 0) {
        const src = scripts[0].src;
        return src.substring(0, src.lastIndexOf('/') + 1);
    }
    return 'https://huy-pm.github.io/gmat-errorlog-popup/gmat-og-autoscraping/';
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

async function extractQuestionData() {
    const type = detectQuestionType();
    console.log('Detected GMAT Official DI type:', type);

    if (type === 'Unknown') {
        console.warn('Unknown question type, skipping...');
        return null;
    }

    const extractor = await loadExtractor(type);
    if (!extractor) {
        console.error('Could not load extractor for type:', type);
        return null;
    }

    return extractor.extractQuestionData(state.currentDifficulty);
}

// ============================================
// UI FUNCTIONS
// ============================================

function updateStatus(message) {
    if (state.popup && !state.popup.closed) {
        state.popup.document.getElementById('status').textContent = message;
    }
    console.log('Status:', message);
}

function updateCount() {
    if (state.popup && !state.popup.closed) {
        state.popup.document.getElementById('success-count').textContent = state.extractedQuestions.length;
        state.popup.document.getElementById('skipped-count').textContent = state.failedCount;
        state.popup.document.getElementById('total-count').textContent = state.totalProcessed;
    }
}

// ============================================
// NAVIGATION & EXTRACTION LOOP
// ============================================

async function processCurrentQuestion() {
    if (!state.isRunning) return;

    // Make sure we're on the list page
    if (!isOnListPage()) {
        updateStatus('Waiting for list page...');
        setTimeout(processCurrentQuestion, 1000);
        return;
    }

    // Get pagination info
    const paginationInfo = getPaginationInfo();
    const totalQuestions = paginationInfo ? paginationInfo.total : 0;

    // Check if we've processed all questions
    if (totalQuestions > 0 && state.totalProcessed >= totalQuestions) {
        updateStatus(`Completed! Extracted ${state.extractedQuestions.length}/${totalQuestions} (${state.failedCount} skipped)`);
        stopExtraction();
        return;
    }

    // Get current page's question rows
    const rows = getQuestionRows();

    // Check if we've processed all questions on this page
    if (state.currentQuestionIndex >= rows.length) {
        if (hasNextPage()) {
            updateStatus('Going to next page...');
            state.currentQuestionIndex = 0;
            state.currentPageNumber++;
            clickNextPage();
            setTimeout(processCurrentQuestion, 3000);
            return;
        } else {
            updateStatus(`Completed! Extracted ${state.extractedQuestions.length} questions.`);
            stopExtraction();
            return;
        }
    }

    const row = rows[state.currentQuestionIndex];
    const questionNumber = paginationInfo ? paginationInfo.start + state.currentQuestionIndex : state.currentQuestionIndex + 1;

    updateStatus(`Processing question ${questionNumber} of ${totalQuestions}`);

    // Extract difficulty from the row
    state.currentDifficulty = extractDifficultyFromRow(row);
    console.log('Extracted difficulty:', state.currentDifficulty);

    // Get the review link
    const reviewLink = getReviewLink(row);
    if (!reviewLink) {
        console.warn(`No review link found for question ${questionNumber}, skipping...`);
        state.totalProcessed++;
        state.failedCount++;
        updateCount();
        state.currentQuestionIndex++;
        setTimeout(processCurrentQuestion, 500);
        return;
    }

    // Store current page number before navigating
    state.currentPageNumber = getCurrentPageFromPagination();
    console.log(`On page ${state.currentPageNumber}, clicking review link for question ${questionNumber}`);

    // Click the review link
    reviewLink.click();

    // Wait for question page to load, then extract
    setTimeout(extractFromQuestionPage, 2500);
}

async function extractFromQuestionPage() {
    if (!state.isRunning) return;

    // Make sure we're on the question page
    if (!isOnQuestionPage()) {
        updateStatus('Waiting for question page...');
        setTimeout(extractFromQuestionPage, 1000);
        return;
    }

    // Extract question data
    const questionData = await extractQuestionData();

    if (questionData) {
        // Check for duplicates
        const isDuplicate = state.extractedQuestions.some(q => q.questionLink === questionData.questionLink);

        if (isDuplicate) {
            console.log('Skipping duplicate question:', questionData.questionLink);
        } else {
            state.extractedQuestions.push(questionData);
            updateCount();
            console.log('Extracted question:', questionData.questionLink);
        }
        state.totalProcessed++;
        updateCount();
    } else {
        console.warn('Failed to extract question data');
        state.totalProcessed++;
        state.failedCount++;
        updateCount();
    }

    // Return to list page using browser back
    updateStatus(`Returning to list page ${state.currentPageNumber}...`);
    history.back();

    // Move to next question
    state.currentQuestionIndex++;

    // Wait for list page to reload
    setTimeout(ensureCorrectPageAndContinue, 2500);
}

function ensureCorrectPageAndContinue() {
    if (!state.isRunning) return;

    if (!isOnListPage()) {
        updateStatus('Waiting for list page...');
        setTimeout(ensureCorrectPageAndContinue, 1000);
        return;
    }

    const actualPage = getCurrentPageFromPagination();

    if (actualPage !== state.currentPageNumber) {
        updateStatus(`Navigating back to page ${state.currentPageNumber}...`);
        // Navigate to correct page
        const pageLinks = document.querySelectorAll('.answers-pagination a.page-link');
        for (let i = 0; i < pageLinks.length; i++) {
            if (pageLinks[i].textContent.trim() === String(state.currentPageNumber)) {
                pageLinks[i].click();
                setTimeout(ensureCorrectPageAndContinue, 2000);
                return;
            }
        }
    }

    processCurrentQuestion();
}

// ============================================
// CONTROL FUNCTIONS
// ============================================

export function startExtraction(popup) {
    if (state.isRunning) return;

    state.isRunning = true;
    state.startTime = new Date();
    state.extractedQuestions = [];
    state.currentQuestionIndex = 0;
    state.currentDifficulty = '';
    state.totalProcessed = 0;
    state.failedCount = 0;
    state.currentPageNumber = 1;
    state.popup = popup;

    // Update UI
    if (popup && !popup.closed) {
        popup.document.getElementById('start-btn').disabled = true;
        popup.document.getElementById('stop-btn').disabled = false;
        popup.document.getElementById('status').textContent = 'Starting...';
        popup.document.getElementById('status').style.color = 'green';
    }

    processCurrentQuestion();
}

export function stopExtraction() {
    state.isRunning = false;

    if (state.popup && !state.popup.closed) {
        state.popup.document.getElementById('start-btn').disabled = false;
        state.popup.document.getElementById('stop-btn').disabled = true;
        state.popup.document.getElementById('status').textContent = 'Stopped';
        state.popup.document.getElementById('status').style.color = 'red';
    }

    if (state.extractedQuestions.length > 0) {
        saveQuestionsToJSON();
    }
}

function saveQuestionsToJSON() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        let categoryPart = '';
        if (state.extractedQuestions.length > 0 && state.extractedQuestions[0].category) {
            categoryPart = state.extractedQuestions[0].category.toLowerCase() + '-';
        }

        const filename = `gmat-og-di-${categoryPart}${timestamp}.json`;

        const output = {
            totalRecords: state.extractedQuestions.length,
            questions: state.extractedQuestions
        };

        const jsonData = JSON.stringify(output, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        console.log('Questions saved to', filename);
    } catch (error) {
        console.error('Error saving questions to JSON:', error);
    }
}

export function getState() {
    return state;
}
