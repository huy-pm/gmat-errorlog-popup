/**
 * GMAT Hero Autoscraping - Shared Utilities
 * Common functions used across all extractors
 */

// ============================================================================
// ASYNC HELPERS
// ============================================================================

/**
 * Promise-based delay
 * @param {number} ms - Milliseconds to wait
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// HTML/TEXT PROCESSING
// ============================================================================

/**
 * Decode HTML entities
 * @param {string} text - Text containing HTML entities
 * @returns {string} Decoded text
 */
export function decodeHtmlEntities(text) {
    if (!text) return '';
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

// ============================================================================
// CURRENCY PROCESSING
// ============================================================================

/**
 * Escape currency symbols in plain text (e.g., $650, $21,300)
 * This should be called BEFORE KaTeX processing, when currency is plain text
 * and math expressions are still inside KaTeX elements.
 * 
 * Uses callback to check character after match to avoid regex backtracking issues
 * @param {Text} textNode - DOM text node to process
 */
export function escapeCurrencyInTextNode(textNode) {
    let text = textNode.textContent;
    if (!text.includes('$')) return;

    // Match $NUMBER and use callback to check what follows
    const newText = text.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, function (match, number, offset, str) {
        // Check character immediately after the match
        const charAfter = str.charAt(offset + match.length);

        // If followed by a letter, it's a LaTeX variable like $0.125k - don't escape
        if (/[a-zA-Z]/.test(charAfter)) {
            return match;
        }

        // Otherwise, it's currency - escape it
        return '\\$' + number;
    });

    if (newText !== text) {
        textNode.textContent = newText;
    }
}

/**
 * Normalize currency format in extracted text
 * Converts KaTeX-wrapped currency like $\$247.00$ to just \$247.00
 * This ensures consistent output regardless of how GMAT Hero renders currency
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeCurrency(text) {
    if (!text) return '';
    // Pattern: $\$NUMBER$ - KaTeX wrapped escaped currency
    // Convert to just \$NUMBER
    return text.replace(/\$\\?\\\$(\d[\d,]*(?:\.\d+)?)\$/g, '\\$$1');
}

/**
 * Walk through text nodes in an element and escape currency
 * Skips nodes that are inside KaTeX elements
 * @param {Element} element - DOM element to process
 */
export function escapeCurrencyInElement(element) {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                // Skip if inside a KaTeX element
                let parent = node.parentNode;
                while (parent && parent !== element) {
                    if (parent.classList && parent.classList.contains('katex')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentNode;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(escapeCurrencyInTextNode);
}

// ============================================================================
// KATEX/MATH PROCESSING
// ============================================================================

/**
 * Process KaTeX elements in a container and convert to TeX notation
 * @param {Element} container - DOM element containing KaTeX elements
 */
export function processKaTeX(container) {
    const katexElements = container.querySelectorAll('.katex');
    katexElements.forEach(function (katexElem) {
        const mathml = katexElem.querySelector('.katex-mathml');
        if (mathml) {
            const annotation = mathml.querySelector('annotation');
            if (annotation) {
                const texContent = annotation.textContent;
                const isDisplay = texContent.includes('\\dfrac') || texContent.includes('\\frac') ||
                    texContent.includes('\\int') || texContent.includes('\\sum');
                const mathPlaceholder = document.createTextNode(isDisplay ? '$$' + texContent + '$$' : '$' + texContent + '$');
                katexElem.replaceWith(mathPlaceholder);
            }
        }
    });
}

// ============================================================================
// TEXT FORMATTING
// ============================================================================

/**
 * Convert styled spans to markdown format for boldface questions
 * - Italicized spans (font-style: italic) -> *text*
 * - Bold spans or default -> **text**
 * @param {string} htmlContent - HTML content
 * @returns {string} Markdown formatted content
 */
export function convertStyledSpansToMarkdown(htmlContent) {
    if (!htmlContent) return '';
    // Match spans with style containing font-weight, font-style, etc.
    return htmlContent.replace(/<span[^>]*style="([^"]*)"[^>]*>(.*?)<\/span>/gi, function (match, style, content) {
        if (style.includes('font-style: italic') || style.includes('font-style:italic')) {
            return '*' + content + '*';
        }
        if (style.includes('font-weight: bold') || style.includes('font-weight:bold') ||
            style.includes('font-weight: 700') || style.includes('font-weight:700')) {
            return '**' + content + '**';
        }
        return content;
    });
}

/**
 * Convert highlighted text to markdown format for RC questions
 * - Yellow background spans -> ==text==
 * @param {string} htmlContent - HTML content
 * @returns {string} Markdown formatted content
 */
export function convertHighlightedTextToMarkdown(htmlContent) {
    if (!htmlContent) return '';
    // Match spans with yellow/highlight background
    return htmlContent.replace(/<span[^>]*(?:class="[^"]*highlight[^"]*"|style="[^"]*background[^"]*yellow[^"]*")[^>]*>(.*?)<\/span>/gi, function (match, content) {
        return '==' + content + '==';
    });
}

/**
 * Extract highlight ranges from text with ==marker== format
 * @param {string} textWithMarkers - Text containing ==highlighted== markers
 * @returns {{ cleanText: string, highlightRanges: Array<{start: number, end: number}> }}
 */
export function extractHighlightRanges(textWithMarkers) {
    if (!textWithMarkers) return { cleanText: '', highlightRanges: [] };

    const highlightRanges = [];
    let cleanText = '';
    let currentPos = 0;
    let i = 0;

    while (i < textWithMarkers.length) {
        if (textWithMarkers.substring(i, i + 2) === '==') {
            // Find the closing ==
            const closeIndex = textWithMarkers.indexOf('==', i + 2);
            if (closeIndex !== -1) {
                const highlightedContent = textWithMarkers.substring(i + 2, closeIndex);
                const start = currentPos;
                cleanText += highlightedContent;
                currentPos += highlightedContent.length;
                highlightRanges.push({ start, end: currentPos });
                i = closeIndex + 2;
                continue;
            }
        }
        cleanText += textWithMarkers[i];
        currentPos++;
        i++;
    }

    return { cleanText, highlightRanges };
}

// ============================================================================
// URL HELPERS
// ============================================================================

/**
 * Get practice URL from current URL (replace /review/ with /practice/)
 * @returns {string} Practice URL
 */
export function getPracticeUrl() {
    const currentUrl = window.location.href;
    return currentUrl.replace('/review/', '/practice/');
}

// ============================================================================
// COMPLETION PATTERN DETECTION
// ============================================================================

/**
 * Patterns that indicate a sentence-completion style question without a question mark.
 * These are incomplete sentences that the answer choices complete.
 */
export const COMPLETION_PATTERNS = [
    /best serves? as part of an argument that\s*$/i,
    /best completes? the (?:passage|argument|reasoning)\s*$/i,
    /logically completes? the (?:passage|argument|reasoning)\s*$/i,
    /most logically completes?\s*$/i,
    /most reasonably (?:drawn|concludes|inferred)\s*$/i,
    /is most strongly supported\s*$/i,
    /can most properly be inferred\s*$/i,
    /best explains?\s*$/i,
    /most helps? to\s*$/i,
    /provides? the strongest\s*$/i,
    /serves? to\s*$/i,
    /argument by\s*$/i,
    /responds? to\s*$/i,
];

/**
 * Check if a text matches any sentence-completion style question pattern.
 * @param {string} text - The text to check (should be trimmed)
 * @returns {boolean} True if the text matches a completion pattern
 */
export function isCompletionStyleQuestion(text) {
    if (!text) return false;
    const trimmedText = text.trim();

    // If it ends with a question mark, it's not a completion style
    if (trimmedText.endsWith('?')) return false;

    // Check against completion patterns
    for (const pattern of COMPLETION_PATTERNS) {
        if (pattern.test(trimmedText)) {
            return true;
        }
    }

    return false;
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

/**
 * Extract metadata from GMAT Hero page (category, difficulty, selected/correct answers, time spent)
 * @returns {Object} Metadata object
 */
export function extractGMATHeroMetadata() {
    const metadata = {
        isReviewMode: false,
        category: null,
        selectedAnswer: null,
        difficulty: null,
        timeSpent: null,
        correctAnswer: null
    };

    // 1. Check is this review-mode
    const reviewModeEl = document.querySelector('.review-mode');
    metadata.isReviewMode = !!reviewModeEl;

    // 2. Extract category from .hide-small.centered
    const categoryEl = document.querySelector('.hide-small.centered');
    const url = window.location.href.toLowerCase();

    if (url.includes('quant') || url.includes('qt') || url.includes('rq') ||
        url.includes('cr') || url.includes('rcr')) {
        if (categoryEl) {
            const fullText = categoryEl.textContent.trim();
            const parts = fullText.split('-');
            if (parts.length > 1) {
                metadata.category = parts[parts.length - 1].trim();
            } else {
                metadata.category = fullText;
            }
        }
    } else if (url.includes('rc') || url.includes('rrc')) {
        metadata.category = 'rc';
    } else {
        metadata.category = '';
    }

    // 3. Extract selected answer
    // Priority 1: Check for selected-answer class
    const selectedLabel = document.querySelector('.selected-answer');
    if (selectedLabel) {
        const forAttr = selectedLabel.getAttribute('for');
        if (forAttr) {
            const parts = forAttr.split('-');
            metadata.selectedAnswer = parts[parts.length - 1];

            // Check if it is correct
            const standardChoices = selectedLabel.closest('.standard-choices');
            if (standardChoices && standardChoices.classList.contains('has-answered-correctly')) {
                metadata.correctAnswer = metadata.selectedAnswer;
            }
        }
    }

    // Priority 2: Fallback to round-div (history)
    if (!metadata.selectedAnswer) {
        const roundDivs = document.querySelectorAll('.round-div');
        if (roundDivs.length > 0) {
            const lastRoundDiv = roundDivs[roundDivs.length - 1];
            metadata.selectedAnswer = lastRoundDiv.textContent.trim();

            if (lastRoundDiv.classList.contains('green')) {
                metadata.correctAnswer = metadata.selectedAnswer;
            }
        }
    }

    // 4. Extract difficulty from .level-badge
    const levelBadgeEl = document.querySelector('.level-badge');
    if (levelBadgeEl) {
        const difficultyText = levelBadgeEl.textContent.trim();
        const difficultyNum = parseInt(difficultyText, 10);

        if (!isNaN(difficultyNum)) {
            if (difficultyNum < 600) {
                metadata.difficulty = 'easy';
            } else if (difficultyNum < 700) {
                metadata.difficulty = 'medium';
            } else {
                metadata.difficulty = 'hard';
            }
        }
    }

    // 5. Extract time spent from .pi-clock
    const clockIcon = document.querySelector('.pi-clock');
    if (clockIcon && clockIcon.nextElementSibling) {
        metadata.timeSpent = clockIcon.nextElementSibling.textContent.trim();
    }

    // 6. Extract correct answer if not found yet
    if (!metadata.correctAnswer) {
        const correctAnswerLabel = document.querySelector('.correct-answer');
        if (correctAnswerLabel) {
            const forAttr = correctAnswerLabel.getAttribute('for');
            if (forAttr) {
                const parts = forAttr.split('-');
                metadata.correctAnswer = parts[parts.length - 1];
            }
        }
    }

    return metadata;
}

// ============================================================================
// QUESTION TYPE DETECTION
// ============================================================================

/**
 * Detect the current question type based on DOM structure
 * @returns {string|null} Question type: 'quant', 'cr', 'rc', 'di-gi', 'di-msr', 'di-ta', 'di-tpa', or null
 */
export function detectQuestionType() {
    // DI Types (check first as they have specific containers)
    if (document.querySelector('.dropdown-selection')) return 'di-gi';
    if (document.querySelector('.ir-msr')) return 'di-msr';
    if (document.querySelector('.ir-ta')) return 'di-ta';
    if (document.querySelector('.tpa-question')) return 'di-tpa';

    // Verbal Types (use panel structure)
    if (document.querySelector('#left-panel .passage')) return 'rc';

    // CR: has question stem but no passage and no KaTeX math
    const hasQuestionStem = document.querySelector('#right-panel .question-stem');
    const hasPassage = document.querySelector('#left-panel .passage');
    const hasKaTeX = document.querySelector('.katex');

    if (hasQuestionStem && !hasPassage && !hasKaTeX) return 'cr';

    // Quant (has KaTeX math and not DI selectors)
    if (hasKaTeX) return 'quant';

    return null;
}

/**
 * Detect the section (quant, verbal, di) from question type
 * @param {string} questionType - Question type
 * @returns {string} Section: 'quant', 'verbal', or 'di'
 */
export function getSectionFromType(questionType) {
    if (!questionType) return 'unknown';

    if (questionType === 'quant') return 'quant';
    if (questionType === 'cr' || questionType === 'rc') return 'verbal';
    if (questionType.startsWith('di-')) return 'di';

    return 'unknown';
}

/**
 * Get category label from question type
 * @param {string} questionType - Question type
 * @returns {string} Category label (e.g., 'GI', 'MSR', 'TA', 'TPA', 'CR', 'RC')
 */
export function getCategoryFromType(questionType) {
    const categoryMap = {
        'di-gi': 'GI',
        'di-msr': 'MSR',
        'di-ta': 'TA',
        'di-tpa': 'TPA',
        'cr': 'CR',
        'rc': 'RC',
        'quant': '' // Quant uses custom category from metadata
    };

    return categoryMap[questionType] || '';
}
