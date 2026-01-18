/**
 * GMAT Hero Autoscraping - Core Module
 * Popup UI, processing loop, state management, and navigation
 */

import { delay, detectQuestionType, getSectionFromType } from './gmat-hero-utils.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export const state = {
    extractedQuestions: [],
    isRunning: false,
    popup: null,
    currentExtractor: null,
    startTime: null,
    extractorCache: {},
    incorrectOnly: false
};

// ============================================================================
// POPUP UI
// ============================================================================

/**
 * Create and display the popup window
 * @param {string} title - Title for the popup
 * @returns {Window} Popup window reference
 */
export function createPopup(title = 'GMAT Hero Extractor') {
    const popup = window.open('', title, 'width=600,height=400,scrollbars=yes');

    popup.document.write(`
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    line-height: 1.6;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    color: #fff;
                }
                .container {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 12px;
                    padding: 24px;
                    color: #333;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                }
                h2 { 
                    text-align: center; 
                    color: #333;
                    margin-bottom: 20px;
                }
                .controls { 
                    text-align: center; 
                    margin: 20px 0; 
                }
                button { 
                    padding: 12px 24px; 
                    margin: 5px; 
                    cursor: pointer; 
                    color: white; 
                    border: none; 
                    border-radius: 6px; 
                    font-size: 16px;
                    font-weight: 600;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                #start-btn { 
                    background: linear-gradient(135deg, #4CAF50, #45a049);
                }
                #stop-btn { 
                    background: linear-gradient(135deg, #f44336, #d32f2f);
                }
                button:disabled { 
                    background: #ccc; 
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                .status { 
                    text-align: center; 
                    margin-top: 20px; 
                    font-weight: bold;
                    font-size: 16px;
                }
                .count { 
                    text-align: center; 
                    font-size: 32px; 
                    color: #667eea; 
                    margin-top: 10px;
                    font-weight: bold;
                }
                .type-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background: #667eea;
                    color: white;
                    border-radius: 20px;
                    font-size: 12px;
                    margin-top: 10px;
                }
                .instructions {
                    background: #f8f9fa;
                    padding: 15px;
                    border-left: 4px solid #667eea;
                    margin: 20px 0;
                    border-radius: 0 6px 6px 0;
                }
                .instructions ol {
                    margin: 10px 0 0 0;
                    padding-left: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🎯 ${title}</h2>
                <div class="instructions">
                    <strong>Instructions:</strong>
                    <ol>
                        <li>Click "Start" to begin extracting questions</li>
                        <li>The script will automatically navigate through questions</li>
                        <li>Click "Stop" to stop and save all questions</li>
                    </ol>
                </div>
                <div class="options" style="margin-bottom: 15px; padding: 10px; background: #f0f0f0; border-radius: 6px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" id="incorrect-only-checkbox" style="width: 18px; height: 18px; cursor: pointer;">
                        <span>Extract incorrect questions only</span>
                    </label>
                </div>
                <div class="controls">
                    <button id="start-btn" onclick="window.opener.gmatheroStartExtraction()">Start</button>
                    <button id="stop-btn" onclick="window.opener.gmatheroStopExtraction()" disabled>Stop</button>
                </div>
                <div class="status">Status: <span id="status">Ready</span></div>
                <div class="count"><span id="count">0</span></div>
                <div style="text-align: center;">
                    <span class="type-badge" id="type-badge">Detecting...</span>
                </div>
            </div>
        </body>
        </html>
    `);

    state.popup = popup;
    return popup;
}

/**
 * Update the status display in the popup
 * @param {string} text - Status text
 * @param {string} color - CSS color
 */
export function updateStatus(text, color = 'inherit') {
    if (state.popup && !state.popup.closed) {
        const statusEl = state.popup.document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.style.color = color;
        }
    }
}

/**
 * Update the count display in the popup
 * @param {number} count - Number of extracted questions
 */
export function updateCount(count) {
    if (state.popup && !state.popup.closed) {
        const countEl = state.popup.document.getElementById('count');
        if (countEl) {
            countEl.textContent = count;
        }
    }
}

/**
 * Update the question type badge in the popup
 * @param {string} type - Question type
 */
export function updateTypeBadge(type) {
    if (state.popup && !state.popup.closed) {
        const badgeEl = state.popup.document.getElementById('type-badge');
        if (badgeEl) {
            const typeLabels = {
                'quant': '📐 Quant',
                'ds': '🧮 Data Sufficiency',
                'cr': '💭 Critical Reasoning',
                'rc': '📖 Reading Comprehension',
                'di-gi': '📊 Graphics Interpretation',
                'di-msr': '📑 Multi-Source Reasoning',
                'di-ta': '📋 Table Analysis',
                'di-tpa': '🔢 Two-Part Analysis'
            };
            badgeEl.textContent = typeLabels[type] || type || 'Unknown';
        }
    }
}

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Click the next button to navigate to the next question
 * @returns {boolean} True if next button was clicked
 */
export function clickNextButton() {
    const footer = document.querySelector('footer');
    if (footer) {
        const navElements = footer.querySelectorAll('.pointer.disable-select');
        for (const el of navElements) {
            if (el.textContent.toLowerCase().includes('next')) {
                el.click();
                return true;
            }
        }
    }
    return false;
}

/**
 * Click the "Answer" button to reveal correct answer in review mode
 * @returns {boolean} True if answer button was clicked
 */
export function showCorrectAnswer() {
    // 1. Try specific selector first (safest)
    const specificBtns = document.querySelectorAll('.pointer.hover-green.sub.only-review');
    for (const btn of specificBtns) {
        if (btn.textContent.toLowerCase().includes('answer')) {
            console.log('[GMAT Hero] Clicking specific Answer button');
            btn.click();
            return true;
        }
    }

    // 2. Fallback: Try broader search for "Answer" button (useful if classes change)
    // Looking for elements with 'pointer' class or 'only-review' class that imply interactivity
    const candidates = document.querySelectorAll('.pointer, .only-review, button, .btn');
    for (const btn of candidates) {
        const text = btn.textContent ? btn.textContent.toLowerCase().trim() : '';

        // Check for "answer" text
        if (text === 'answer' || text === 'show answer' || (text.includes('answer') && text.length < 20)) {
            // Ensure element is visible
            if (btn.offsetParent === null) continue;

            console.log('[GMAT Hero] Clicking fallback Answer button:', text);
            btn.click();
            return true;
        }
    }

    return false;
}

/**
 * Check if we're on the last question
 * @returns {boolean} True if on last question
 */
export function isLastQuestion() {
    const quizNoEl = document.querySelector('.quiz-no span');
    if (quizNoEl) {
        const text = quizNoEl.textContent.trim();
        const parts = text.split(' of ');
        if (parts.length === 2) {
            return parseInt(parts[0]) === parseInt(parts[1]);
        }
    }
    return false;
}

// ============================================================================
// EXTRACTOR LOADING
// ============================================================================

/**
 * Load the appropriate extractor for the current question type
 * @param {string} type - Question type
 * @returns {Promise<Object>} Extractor module
 */
export async function loadExtractor(type) {
    // Check cache first
    if (state.extractorCache[type]) {
        return state.extractorCache[type];
    }

    const basePath = getBasePath();
    const cacheBuster = `?v=${Date.now()}`;

    const extractorMap = {
        'quant': 'gmat-hero-quant.js',
        'ds': 'gmat-hero-di-ds.js',
        'cr': 'gmat-hero-cr.js',
        'rc': 'gmat-hero-rc.js',
        'di-gi': 'gmat-hero-di-gi.js',
        'di-msr': 'gmat-hero-di-msr.js',
        'di-ta': 'gmat-hero-di-ta.js',
        'di-tpa': 'gmat-hero-di-tpa.js'
    };

    const extractorFile = extractorMap[type];
    if (!extractorFile) {
        console.error(`Unknown question type: ${type}`);
        return null;
    }

    try {
        const module = await import(`${basePath}extractors/${extractorFile}${cacheBuster}`);
        state.extractorCache[type] = module;
        return module;
    } catch (error) {
        console.error(`Failed to load extractor for ${type}:`, error);
        return null;
    }
}

/**
 * Get the base path for module imports
 * @returns {string} Base path URL
 */
function getBasePath() {
    const currentScript = document.currentScript || document.querySelector('script[src*="gmat-hero-loader.js"]');
    if (currentScript && currentScript.src) {
        const scriptUrl = new URL(currentScript.src);
        // Remove query params and get the path without the filename
        const pathWithoutQuery = scriptUrl.origin + scriptUrl.pathname;
        // Remove the filename by finding the last slash
        const lastSlashIndex = pathWithoutQuery.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
            return pathWithoutQuery.substring(0, lastSlashIndex + 1);
        }
        return pathWithoutQuery;
    }
    // Fallback for when loaded as a module
    return './';
}

// ============================================================================
// PROCESSING LOOP
// ============================================================================

/**
 * Main processing loop - extracts questions one by one
 */
export async function processLoop() {
    state.extractedQuestions = [];
    updateCount(0);

    while (state.isRunning) {
        // 1. Detect current question type
        const questionType = detectQuestionType();
        updateTypeBadge(questionType);

        if (!questionType) {
            console.warn('Could not detect question type');
            updateStatus('Unknown question type', 'orange');
            await delay(1000);

            // Try to move to next question
            if (!clickNextButton()) {
                stopExtraction();
                return;
            }
            await delay(3000);
            continue;
        }

        // 2. Load appropriate extractor
        const extractor = await loadExtractor(questionType);
        if (!extractor) {
            console.error(`Failed to load extractor for ${questionType}`);
            await delay(1000);
            if (!clickNextButton()) {
                stopExtraction();
                return;
            }
            await delay(3000);
            continue;
        }

        // 3. Show correct answer (review mode)
        if (showCorrectAnswer()) {
            await delay(1000);
        }

        // 3.5. Check if we should skip this question (incorrect only mode)
        if (state.incorrectOnly) {
            // Check if the question was answered incorrectly by looking at the standard-choices class
            const standardChoices = document.querySelector('.standard-choices');
            const isIncorrect = standardChoices && standardChoices.classList.contains('has-answered-incorrectly');
            const isCorrect = standardChoices && standardChoices.classList.contains('has-answered-correctly');

            console.log('[GMAT Hero] Answer check:', { isIncorrect, isCorrect });

            if (isCorrect) {
                console.log('[GMAT Hero] Skipping correct question');
                updateStatus('Skipping correct...', 'gray');

                // Navigate to next question
                if (isLastQuestion()) {
                    stopExtraction();
                    return;
                }
                if (!clickNextButton()) {
                    stopExtraction();
                    return;
                }
                await delay(3000);
                continue;
            } else if (isIncorrect) {
                console.log('[GMAT Hero] Extracting incorrect question');
                updateStatus('Extracting incorrect...', 'orange');
            } else {
                // No answer found (maybe DI question type or unanswered) - still extract
                console.log('[GMAT Hero] No answer status found, extracting anyway');
            }
        }

        // 4. Extract question data
        try {
            const data = await extractor.extractQuestionData();
            if (data) {
                // Special handling for MSR - it returns a question SET that accumulates
                // We need to update the existing entry instead of pushing duplicates
                if (questionType === 'di-msr') {
                    // Find existing entry with same tab signature (same data sources)
                    const existingIndex = state.extractedQuestions.findIndex(
                        q => q._tabSignature && q._tabSignature === data._tabSignature
                    );
                    if (existingIndex >= 0) {
                        // Update existing entry with accumulated questions
                        state.extractedQuestions[existingIndex] = data;
                    } else {
                        // New question set
                        state.extractedQuestions.push(data);
                    }
                } else {
                    // Normal question types - push each question
                    state.extractedQuestions.push(data);
                }
                // Calculate total question count (MSR sets contain multiple questions)
                const totalCount = state.extractedQuestions.reduce((sum, q) => {
                    // MSR question sets have a questions array
                    return sum + (q.questions ? q.questions.length : 1);
                }, 0);
                updateCount(totalCount);
                console.log(`Extracted ${questionType} question:`, data);
            }
        } catch (error) {
            console.error(`Error extracting ${questionType}:`, error);
        }

        // 5. Check if last question
        if (isLastQuestion()) {
            stopExtraction();
            return;
        }

        // 6. Navigate to next question
        if (!clickNextButton()) {
            stopExtraction();
            return;
        }

        // 7. Wait for page to load
        await delay(3000);
    }
}

// ============================================================================
// START/STOP EXTRACTION
// ============================================================================

/**
 * Start the extraction process
 */
export function startExtraction() {
    if (state.isRunning) return;

    state.isRunning = true;
    state.startTime = new Date();
    state.extractedQuestions = [];

    // Read checkbox state
    if (state.popup && !state.popup.closed) {
        const checkbox = state.popup.document.getElementById('incorrect-only-checkbox');
        state.incorrectOnly = checkbox ? checkbox.checked : false;
    }

    // Update UI
    if (state.popup && !state.popup.closed) {
        const startBtn = state.popup.document.getElementById('start-btn');
        const stopBtn = state.popup.document.getElementById('stop-btn');
        const checkbox = state.popup.document.getElementById('incorrect-only-checkbox');
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (checkbox) checkbox.disabled = true; // Disable checkbox while running
    }

    updateStatus('Running...', 'green');
    if (state.incorrectOnly) {
        console.log('[GMAT Hero] Filtering mode: Incorrect questions only');
    }

    // Start the loop
    processLoop();
}

/**
 * Stop the extraction process and save results
 */
export function stopExtraction() {
    state.isRunning = false;

    // Update UI
    if (state.popup && !state.popup.closed) {
        const startBtn = state.popup.document.getElementById('start-btn');
        const stopBtn = state.popup.document.getElementById('stop-btn');
        const checkbox = state.popup.document.getElementById('incorrect-only-checkbox');
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (checkbox) checkbox.disabled = false; // Re-enable checkbox
    }

    updateStatus('Stopped', 'red');

    // Save questions
    if (state.extractedQuestions.length > 0) {
        saveQuestionsToJSON();
    }
}

// ============================================================================
// JSON EXPORT
// ============================================================================

/**
 * Save extracted questions to a JSON file
 */
export function saveQuestionsToJSON() {
    if (state.extractedQuestions.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Determine filename based on extracted content
    let prefix = 'gmat-questions';
    if (state.extractedQuestions.length > 0) {
        const firstQuestion = state.extractedQuestions[0];
        const section = firstQuestion.section || 'mixed';
        const category = firstQuestion.category || '';
        prefix = `gmat-${section}${category ? '-' + category.toLowerCase() : ''}`;
    }

    const filename = `${prefix}-${timestamp}.json`;
    const jsonData = JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalRecords: state.extractedQuestions.length,
        questions: state.extractedQuestions
    }, null, 2);

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

    console.log(`Saved ${state.extractedQuestions.length} questions to ${filename}`);
}

// ============================================================================
// GLOBAL EXPORTS (for popup onclick handlers)
// ============================================================================

// Expose functions globally so popup can access them
window.gmatheroStartExtraction = startExtraction;
window.gmatheroStopExtraction = stopExtraction;
