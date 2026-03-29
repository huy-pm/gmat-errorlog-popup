/**
 * Batch Content Scraper
 *
 * Runs in the content script context on GMAT Hero pages.
 * Ports the processLoop from gmat-hero-core.js with static extractor imports.
 * Communicates results back to the background service worker.
 */

// Import utilities from the autoscraping modules
// These are aliased in vite.config.ts to the actual JS files
import {
    delay,
    detectQuestionType,
    getSectionFromType,
    extractGMATHeroMetadata
    // @ts-ignore - JS module
} from '@gmat-hero-autoscraping/utils';

// Static imports for all extractors (replacing dynamic import())
// @ts-ignore - JS module
import { extractQuestionData as extractQuant } from '@gmat-hero-autoscraping/extractors/gmat-hero-quant';
// @ts-ignore - JS module
import { extractQuestionData as extractCR } from '@gmat-hero-autoscraping/extractors/gmat-hero-cr';
// @ts-ignore - JS module
import { extractQuestionData as extractRC } from '@gmat-hero-autoscraping/extractors/gmat-hero-rc';
// @ts-ignore - JS module
import { extractQuestionData as extractDIGI } from '@gmat-hero-autoscraping/extractors/gmat-hero-di-gi';
// @ts-ignore - JS module
import { extractQuestionData as extractDIMSR, reset as resetMSR } from '@gmat-hero-autoscraping/extractors/gmat-hero-di-msr';
// @ts-ignore - JS module
import { extractQuestionData as extractDITA } from '@gmat-hero-autoscraping/extractors/gmat-hero-di-ta';
// @ts-ignore - JS module
import { extractQuestionData as extractDITPA } from '@gmat-hero-autoscraping/extractors/gmat-hero-di-tpa';
// @ts-ignore - JS module
import { extractQuestionData as extractDIDS } from '@gmat-hero-autoscraping/extractors/gmat-hero-di-ds';

import type { ExtractedQuestion, BatchError } from './types';

const extractorMap: Record<string, () => Promise<ExtractedQuestion | null>> = {
    'quant': extractQuant,
    'cr': extractCR,
    'rc': extractRC,
    'di-gi': extractDIGI,
    'di-msr': extractDIMSR,
    'di-ta': extractDITA,
    'di-tpa': extractDITPA,
    'ds': extractDIDS
};

/**
 * Click the next button to navigate to the next question
 */
function clickNextButton(): boolean {
    const footer = document.querySelector('footer');
    if (footer) {
        const navElements = footer.querySelectorAll('.pointer.disable-select');
        for (const el of navElements) {
            if (el.textContent?.toLowerCase().includes('next')) {
                (el as HTMLElement).click();
                return true;
            }
        }
    }
    return false;
}

/**
 * Click the "Answer" button to reveal correct answer in review mode
 */
function showCorrectAnswer(): boolean {
    const specificBtns = document.querySelectorAll('.pointer.hover-green.sub.only-review');
    for (const btn of specificBtns) {
        if (btn.textContent?.toLowerCase().includes('answer')) {
            (btn as HTMLElement).click();
            return true;
        }
    }

    const candidates = document.querySelectorAll('.pointer, .only-review, button, .btn');
    for (const btn of candidates) {
        const text = btn.textContent?.toLowerCase().trim() || '';
        if (text === 'answer' || text === 'show answer' || (text.includes('answer') && text.length < 20)) {
            if ((btn as HTMLElement).offsetParent === null) continue;
            (btn as HTMLElement).click();
            return true;
        }
    }

    return false;
}

/**
 * Extract the GMAT Club link via background script using chrome.scripting.executeScript
 * with world: 'MAIN', which runs in the page's JS context (not the isolated content script
 * context). This is required because Angular's click handler calls window.open() in the
 * page context — overriding window.open in the content script has no effect.
 *
 * Flow: content script → background (EXTRACT_GMAT_CLUB_LINK) →
 *       chrome.scripting.executeScript(world:'MAIN') → capture URL → return to content script
 */
async function extractGmatClubLink(): Promise<string | null> {
    try {
        // Quick DOM check first — skip the round-trip if button isn't visible
        const footerDivs = document.querySelectorAll('.gmat-sub-footer .pointer.disable-select.sub');
        let hasGmatClubBtn = false;
        for (const div of footerDivs) {
            if (div.textContent?.trim().includes('GMAT Club')) {
                hasGmatClubBtn = true;
                break;
            }
        }
        if (!hasGmatClubBtn) return null;

        return new Promise<string | null>((resolve) => {
            chrome.runtime.sendMessage(
                { action: 'EXTRACT_GMAT_CLUB_LINK' },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Batch] EXTRACT_GMAT_CLUB_LINK failed:', chrome.runtime.lastError.message);
                        resolve(null);
                    } else {
                        resolve(response?.url || null);
                    }
                }
            );
        });
    } catch (err) {
        console.warn('[Batch] Failed to extract GMAT Club link:', err);
        return null;
    }
}

/**
 * Check if we're on the last question
 */
function isLastQuestion(): boolean {
    const quizNoEl = document.querySelector('.quiz-no span');
    if (quizNoEl) {
        const text = quizNoEl.textContent?.trim() || '';
        const parts = text.split(' of ');
        if (parts.length === 2) {
            return parseInt(parts[0]) === parseInt(parts[1]);
        }
    }
    return false;
}

/**
 * Main scraping loop for the current category page.
 * Extracts all questions and sends results back to the background worker.
 */
export async function scrapeCurrentPage(categoryId: string, incorrectOnly: boolean): Promise<void> {
    const extractedQuestions: ExtractedQuestion[] = [];
    const errors: BatchError[] = [];
    let questionIndex = 0;

    // Reset MSR state for new category
    if (typeof resetMSR === 'function') {
        resetMSR();
    }

    // Wait for the page to be ready
    await waitForPageReady();

    let running = true;

    // Listen for stop command
    const stopListener = (message: { action: string }) => {
        if (message.action === 'BATCH_STOP') {
            running = false;
        }
    };
    chrome.runtime.onMessage.addListener(stopListener);

    try {
        while (running) {
            // 1. Detect current question type
            const questionType = detectQuestionType();

            if (!questionType) {
                console.warn('[Batch] Could not detect question type');
                errors.push({
                    categoryId,
                    categoryName: categoryId,
                    questionIndex,
                    questionLink: window.location.href,
                    error: 'Could not detect question type',
                    severity: 'warning'
                });

                await delay(1000);
                if (!clickNextButton()) break;
                await delay(1000);
                questionIndex++;
                continue;
            }

            // 2. Get the extractor
            const extractor = extractorMap[questionType];
            if (!extractor) {
                console.error(`[Batch] No extractor for type: ${questionType}`);
                errors.push({
                    categoryId,
                    categoryName: categoryId,
                    questionIndex,
                    questionLink: window.location.href,
                    error: `No extractor for type: ${questionType}`,
                    severity: 'error'
                });

                await delay(1000);
                if (!clickNextButton()) break;
                await delay(1000);
                questionIndex++;
                continue;
            }

            // 3. Show correct answer (review mode)
            if (showCorrectAnswer()) {
                await delay(1000);
            }

            // 3.5. Check incorrect-only filter
            if (incorrectOnly) {
                const standardChoices = document.querySelector('.standard-choices');
                const isCorrect = standardChoices?.classList.contains('has-answered-correctly');

                if (isCorrect) {
                    if (isLastQuestion()) break;
                    if (!clickNextButton()) break;
                    await delay(1000);
                    questionIndex++;
                    continue;
                }
            }

            // 4. Extract GMAT Club link (while in review mode)
            const gmatClubLink = await extractGmatClubLink();

            // 5. Extract question data
            try {
                const data = await extractor();
                if (data) {
                    // Attach GMAT Club link if found
                    if (gmatClubLink) {
                        (data as any).gmatClubLink = gmatClubLink;
                    }

                    if (questionType === 'di-msr') {
                        // MSR: update existing entry with same tab signature
                        const existingIndex = extractedQuestions.findIndex(
                            (q: ExtractedQuestion) => q._tabSignature && q._tabSignature === (data as ExtractedQuestion)._tabSignature
                        );
                        if (existingIndex >= 0) {
                            extractedQuestions[existingIndex] = data as ExtractedQuestion;
                        } else {
                            extractedQuestions.push(data as ExtractedQuestion);
                        }
                    } else {
                        extractedQuestions.push(data as ExtractedQuestion);
                    }
                }
            } catch (error) {
                console.error(`[Batch] Error extracting ${questionType}:`, error);
                errors.push({
                    categoryId,
                    categoryName: categoryId,
                    questionIndex,
                    questionLink: window.location.href,
                    error: `Extraction error: ${(error as Error).message}`,
                    severity: 'error'
                });
            }

            // 6. Check if last question
            if (isLastQuestion()) break;

            // 7. Navigate to next
            if (!clickNextButton()) break;

            // 8. Wait for page load
            await delay(1000);
            questionIndex++;

            // Send progress update (fire-and-forget)
            chrome.runtime.sendMessage({
                action: 'BATCH_SCRAPE_PROGRESS',
                categoryId,
                questionsCount: extractedQuestions.length,
                currentIndex: questionIndex
            }).catch(() => {});
        }
    } finally {
        chrome.runtime.onMessage.removeListener(stopListener);
    }

    console.log(`[Batch] Scraping complete for ${categoryId}: ${extractedQuestions.length} questions, ${errors.length} errors`);

    // Send final progress update
    chrome.runtime.sendMessage({
        action: 'BATCH_SCRAPE_PROGRESS',
        categoryId,
        questionsCount: extractedQuestions.length,
        currentIndex: questionIndex
    }).catch(() => {});

    // Send results back to background (with retry)
    const sendResults = () => {
        chrome.runtime.sendMessage({
            action: 'BATCH_QUESTIONS_RECEIVED',
            categoryId,
            questions: extractedQuestions,
            errors
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[Batch] Failed to send results, retrying in 1s...', chrome.runtime.lastError.message);
                setTimeout(sendResults, 1000);
            } else {
                console.log('[Batch] Results sent successfully');
            }
        });
    };
    sendResults();
}

/**
 * Wait for the GMAT Hero page to be fully loaded and ready for scraping
 */
async function waitForPageReady(): Promise<void> {
    const maxWait = 15000; // 15 seconds max
    const checkInterval = 500;
    let elapsed = 0;

    while (elapsed < maxWait) {
        // Check for question content indicators
        const hasQuestionStem = document.querySelector('#right-panel .question-stem');
        const hasDIContent = document.querySelector('.dropdown-selection, .ir-msr, .ir-ta, .tpa-question');
        const hasPassage = document.querySelector('#left-panel .passage');

        if (hasQuestionStem || hasDIContent || hasPassage) {
            // Additional wait for rendering
            await delay(500);
            return;
        }

        await delay(checkInterval);
        elapsed += checkInterval;
    }

    console.warn('[Batch] Page ready timeout - proceeding anyway');
}
