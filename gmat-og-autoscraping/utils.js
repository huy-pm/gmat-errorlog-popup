/**
 * GMAT OG Autoscraping - Shared Utilities
 * Common functions for text processing, navigation, and metadata extraction
 */

// Helper function to decode HTML entities
export function decodeHtmlEntities(text) {
    var textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

// Get the current page URL
export function getCurrentUrl() {
    return window.location.href;
}

// Convert time format from "52 secs" or "2 mins 52 secs" to "MM:SS" format
export function formatTimeToMMSS(timeString) {
    if (!timeString) return "";

    var minutes = 0;
    var seconds = 0;

    var minsMatch = timeString.match(/(\d+)\s*min(s|ute|utes)?/i);
    if (minsMatch) {
        minutes = parseInt(minsMatch[1], 10);
    }

    var secsMatch = timeString.match(/(\d+)\s*sec(s|ond|onds)?/i);
    if (secsMatch) {
        seconds = parseInt(secsMatch[1], 10);
    }

    if (minutes === 0 && seconds === 0 && !minsMatch && !secsMatch) {
        return timeString;
    }

    var formattedMins = String(minutes).padStart(2, '0');
    var formattedSecs = String(seconds).padStart(2, '0');

    return formattedMins + ":" + formattedSecs;
}

// Async delay helper
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// DETECTION FUNCTIONS
// ============================================

// Detect question type from OG Practice page (DI types)
export function detectQuestionType() {
    // Graphics Interpretation: has inline dropdown results or inline select elements
    if (document.querySelector('.inline-result') || document.querySelector('select.question-choices-inline')) {
        return "GI";
    }

    // Multi-Source Reasoning: has tabbed content panels
    if (document.querySelector('.content-tab')) {
        return "MSR";
    }

    // Table Analysis: has sortable table
    if (document.querySelector('.table-sortable')) {
        return "TA";
    }

    // Two-Part Analysis: has vertical choice table
    if (document.querySelector('.question-choices-vertical')) {
        return "TPA";
    }

    // Data Sufficiency: has DS statements classes OR has the specific DS answer choices
    if (document.querySelector('.ds-statement1') || document.querySelector('.ds-statement2')) {
        return "DS";
    }

    // Check for DS by looking at the answer choices text pattern
    // DS questions always have this specific answer choice: "Statement (1) ALONE is sufficient"
    var choiceContainer = document.querySelector('.question-choices-multi');
    if (choiceContainer) {
        var choiceTexts = choiceContainer.textContent || '';
        if (choiceTexts.includes('Statement (1) ALONE is sufficient') ||
            choiceTexts.includes('BOTH statements TOGETHER are sufficient') ||
            choiceTexts.includes('EACH statement ALONE is sufficient')) {
            return "DS";
        }
    }

    return "Unknown";
}

// ============================================
// ANSWER EXTRACTION HELPERS
// ============================================

// Extract correct answer from review mode classes
export function extractCorrectAnswerFromClass(element) {
    if (element.classList.contains('correct')) {
        return element.getAttribute('data-choice') || "";
    }
    if (element.classList.contains('corrected')) {
        return element.getAttribute('data-choice') || "";
    }
    return null;
}

// Check if an element is marked as incorrect
export function isIncorrectAnswer(element) {
    return element.classList.contains('incorrect');
}

// ============================================
// METADATA EXTRACTION
// ============================================

// Extract question ID (e_id) from OG page
export function extractQuestionId() {
    var eIdElement = document.querySelector('p.e_id');
    return eIdElement ? eIdElement.textContent.trim() : "";
}

// Extract difficulty from list page row
export function extractDifficultyFromRow(row) {
    var difficultyCell = row.querySelector('.li-cell.difficulty');
    if (!difficultyCell) return "";

    var classList = difficultyCell.className;
    if (classList.includes('hard')) return "Hard";
    if (classList.includes('medium')) return "Medium";
    if (classList.includes('easy')) return "Easy";

    return difficultyCell.textContent.trim();
}

// ============================================
// TEXT PROCESSING
// ============================================

// Process highlighted text - convert <mark><span>text</span></mark> to ==text==
export function processHighlights(html) {
    var processed = html.replace(/<mark[^>]*><span[^>]*class="reading-passage-reference"[^>]*>(.*?)<\/span><\/mark>/gi, '==$1==');
    processed = processed.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
    return processed;
}

// Process boldface text - convert <strong>text</strong> to **text**
export function processBoldface(html) {
    return html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
}

// Clean HTML to text
export function htmlToText(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent.trim();
}

// ============================================
// KATEX/MATH PROCESSING
// ============================================

/**
 * Process KaTeX elements in a container and convert to TeX notation
 * @param {Element} container - DOM element containing KaTeX elements
 */
export function processKaTeX(container) {
    var katexElements = container.querySelectorAll('.katex');
    katexElements.forEach(function (katexElem) {
        var mathml = katexElem.querySelector('.katex-mathml');
        if (mathml) {
            var annotation = mathml.querySelector('annotation');
            if (annotation) {
                var texContent = annotation.textContent;
                var isDisplay = texContent.includes('\\dfrac') || texContent.includes('\\frac') ||
                    texContent.includes('\\int') || texContent.includes('\\sum');
                var mathPlaceholder = document.createTextNode(isDisplay ? '$$' + texContent + '$$' : '$' + texContent + '$');
                katexElem.replaceWith(mathPlaceholder);
            }
        }
    });
}

/**
 * Escape currency symbols in plain text (e.g., $650, $21,300)
 * This should be called BEFORE KaTeX processing
 * @param {Text} textNode - DOM text node to process
 */
export function escapeCurrencyInTextNode(textNode) {
    var text = textNode.textContent;
    if (!text.includes('$')) return;

    var newText = text.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, function (match, number, offset, str) {
        var charAfter = str.charAt(offset + match.length);
        // If followed by a letter, it's a LaTeX variable - don't escape
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
 * Walk through text nodes in an element and escape currency
 * Skips nodes that are inside KaTeX elements
 * @param {Element} element - DOM element to process
 */
export function escapeCurrencyInElement(element) {
    var walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                var parent = node.parentNode;
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

    var textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(escapeCurrencyInTextNode);
}

/**
 * Normalize currency format in extracted text
 * Converts KaTeX-wrapped currency like $\$247.00$ to just \$247.00
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeCurrency(text) {
    if (!text) return '';
    return text.replace(/\$\\?\\\$(\d[\d,]*(?:\.\d+)?)\$/g, '\\$$1');
}

// ============================================
// NAVIGATION HELPERS
// ============================================

// Check if we're on the list page
export function isOnListPage() {
    return document.querySelector('li.content[data-content-location]') !== null;
}

// Check if we're on a question detail page
export function isOnQuestionPage() {
    return document.querySelector('#content-question-start') !== null;
}

// Get all question rows from the list page
export function getQuestionRows() {
    return document.querySelectorAll('li.content[data-content-location]');
}

// Get the review link from a question row
export function getReviewLink(row) {
    var actionCell = row.querySelector('.li-cell.action');
    if (!actionCell) return null;

    var reviewLink = actionCell.querySelector('a.link');

    if (reviewLink && reviewLink.classList.contains('hidden')) {
        return null;
    }

    return reviewLink;
}

// Check if there's a next page in pagination
export function hasNextPage() {
    return document.querySelector('.answers-pagination a.page-link.next') !== null;
}

// Click the next page link
export function clickNextPage() {
    var nextLink = document.querySelector('.answers-pagination a.page-link.next');
    if (nextLink) {
        nextLink.click();
        return true;
    }
    return false;
}

// Get pagination info
export function getPaginationInfo() {
    var countDiv = document.querySelector('.answers-displayed-count');
    if (countDiv) {
        var text = countDiv.textContent.trim();
        var match = text.match(/Displaying\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i);
        if (match) {
            return {
                start: parseInt(match[1], 10),
                end: parseInt(match[2], 10),
                total: parseInt(match[3], 10)
            };
        }
    }
    return null;
}

// Get current page number from pagination
export function getCurrentPageFromPagination() {
    var activePageLink = document.querySelector('.answers-pagination li.active span.current:not(.prev)');
    if (activePageLink) {
        var pageNum = parseInt(activePageLink.textContent.trim(), 10);
        if (!isNaN(pageNum)) {
            return pageNum;
        }
    }
    return 1;
}

// Click the "Done Reviewing" button to return to list page
export function clickDoneReviewing() {
    var doneButton = document.querySelector('a.quit.btn-cancel');
    if (doneButton) {
        doneButton.click();
        return true;
    }
    return false;
}
