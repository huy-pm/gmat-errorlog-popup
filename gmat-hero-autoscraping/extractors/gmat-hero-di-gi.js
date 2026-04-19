/**
 * GMAT Hero Autoscraping - Graphics Interpretation (GI) Extractor
 * Extracts DI questions with dropdown selections
 */

import {
    decodeHtmlEntities,
    delay,
    escapeCurrencyInElement,
    normalizeCurrency,
    getPracticeUrl,
    extractGMATHeroMetadata,
    processKaTeX
} from '../gmat-hero-utils.js';

/**
 * Extract text from a node, handling KaTeX math elements properly
 * @param {Node} node - DOM node to extract text from
 * @returns {string} Extracted text with KaTeX converted to TeX notation
 */
function extractTextWithKaTeX(node) {
    // Clone the node to avoid modifying the original DOM
    const clone = node.cloneNode(true);

    // If it's a text node, just return its content
    if (clone.nodeType === Node.TEXT_NODE) {
        return clone.textContent;
    }

    // Process currency and KaTeX elements in the clone
    if (clone.querySelectorAll) {
        escapeCurrencyInElement(clone);
        processKaTeX(clone);
    }

    return normalizeCurrency(clone.textContent);
}

/**
 * Extract Graphics Interpretation question data
 * @returns {Object|null} Question data or null if extraction fails
 */
export async function extractQuestionData() {
    try {
        const rightPanel = document.getElementById('right-panel');
        if (!rightPanel) {
            console.warn('No right panel found');
            return null;
        }

        const questionStem = rightPanel.querySelector('.question-stem');
        if (!questionStem) {
            console.warn('No question stem found');
            return null;
        }

        // 1. Extract Image
        let image = null;
        const imgEl = questionStem.querySelector('img');
        if (imgEl) {
            image = imgEl.src;
        }

        // 2. Extract Main Question Text
        const stemClone = questionStem.cloneNode(true);
        const stemImg = stemClone.querySelector('img');
        if (stemImg) stemImg.remove();

        // Replace <br> with newlines
        let htmlWithLineBreaks = stemClone.innerHTML;
        htmlWithLineBreaks = htmlWithLineBreaks.replace(/<br\s*\/?>/gi, '\n');
        stemClone.innerHTML = htmlWithLineBreaks;

        // Process KaTeX math expressions
        escapeCurrencyInElement(stemClone);
        processKaTeX(stemClone);

        let questionText = normalizeCurrency(stemClone.textContent.trim());
        questionText = questionText.split('\n').map(l => l.trim()).join('\n');
        questionText = questionText.replace(/\n{3,}/g, '\n\n').trim();

        // 3. Process Dropdowns from .dropdown-selection
        const contentData = {
            image: image,
            questionText: decodeHtmlEntities(questionText),
            statements: []
        };

        const dropdownSelection = document.querySelector('.dropdown-selection');
        if (dropdownSelection) {
            const childNodes = Array.from(dropdownSelection.childNodes);
            const chunks = [];
            let currentNodes = [];

            // Split child nodes into sentences based on Line Breaks
            childNodes.forEach(node => {
                let isBr = false;

                // Direct BR element
                if (node.nodeName === 'BR') {
                    isBr = true;
                }
                // SPAN that contains BR children (separator between statements)
                else if (node.nodeName === 'SPAN') {
                    if (node.querySelector && node.querySelector('br')) {
                        isBr = true;
                    }
                }

                if (isBr) {
                    if (currentNodes.length > 0) {
                        chunks.push(currentNodes);
                        currentNodes = [];
                    }
                } else {
                    currentNodes.push(node);
                }
            });
            if (currentNodes.length > 0) chunks.push(currentNodes);

            // Iterate through chunks to build statements
            for (let i = 0; i < chunks.length; i++) {
                const chunkNodes = chunks[i];
                let statementText = '';
                const dropdowns = [];

                for (const node of chunkNodes) {
                    // Check if this node is a dropdown wrapper
                    if (node.classList && (node.classList.contains('dropdown') || node.querySelector('nb-select'))) {
                        // Add placeholder for dropdown
                        statementText += '{dropdown}';

                        // Determine correct answer PER DROPDOWN:
                        //  - If a `.gi-answer` span is present in this dropdown, the user
                        //    got it wrong and that span holds the correct answer.
                        //  - Else if the `nb-select` carries `status-success`, the user
                        //    got it right and the currently-selected text IS the answer.
                        let correctAnswer = null;
                        const giAnswerEl = node.querySelector('.gi-answer');
                        if (giAnswerEl) {
                            correctAnswer = giAnswerEl.textContent.trim();
                        } else {
                            const nbSel = node.querySelector('nb-select');
                            if (nbSel && nbSel.classList.contains('status-success')) {
                                const selectedBtn = node.querySelector('button');
                                if (selectedBtn) {
                                    correctAnswer = selectedBtn.textContent.trim();
                                }
                            }
                        }

                        // Extract Dropdown Options
                        const btn = node.querySelector('button');
                        if (btn) {
                            // Click to open
                            btn.click();
                            await delay(500);

                            // Find all options in the DOM
                            const options = Array.from(document.querySelectorAll('nb-option'))
                                .map(o => o.textContent.trim());

                            const dd = { options: options };
                            if (correctAnswer) dd.correctAnswer = correctAnswer;
                            dropdowns.push(dd);

                            // Close the dropdown
                            btn.click();
                            await delay(300);
                        } else {
                            const dd = { options: [] };
                            if (correctAnswer) dd.correctAnswer = correctAnswer;
                            dropdowns.push(dd);
                        }
                    } else {
                        // Regular text (handle KaTeX if present)
                        statementText += extractTextWithKaTeX(node);
                    }
                }

                // Clean up and add to statements
                const cleanedText = statementText.trim().replace(/\s+/g, ' ');
                if (cleanedText) {
                    contentData.statements.push({
                        text: cleanedText,
                        dropdowns: dropdowns
                    });
                }
            }
        }

        // 4. Correct answers were captured per-dropdown in section 3 above
        //    (both from `.gi-answer` spans when the user answered wrong, and
        //    from `nb-select.status-success` when the user answered right).

        // 5. Metadata
        const metadata = extractGMATHeroMetadata();

        // Construct Final JSON
        const jsonData = {
            questionLink: getPracticeUrl(),
            gmatClubLink: metadata.gmatClubLink || '',
            source: 'gmat-hero',
            difficulty: metadata.difficulty || '',
            section: 'di',
            questionType: 'di',
            category: 'GI',
            content: contentData
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting GI Content:', error);
        return null;
    }
}

export default { extractQuestionData };
