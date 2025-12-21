/**
 * GMAT Hero Autoscraping - Graphics Interpretation (GI) Extractor
 * Extracts DI questions with dropdown selections
 */

import {
    decodeHtmlEntities,
    delay,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../utils.js';

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

        let questionText = stemClone.textContent.trim();
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

                        // Extract Dropdown Options
                        const btn = node.querySelector('button');
                        if (btn) {
                            // Click to open
                            btn.click();
                            await delay(500);

                            // Find all options in the DOM
                            const options = Array.from(document.querySelectorAll('nb-option'))
                                .map(o => o.textContent.trim());

                            dropdowns.push({ options: options });

                            // Close the dropdown
                            btn.click();
                            await delay(300);
                        } else {
                            dropdowns.push({ options: [] });
                        }
                    } else {
                        // Regular text
                        statementText += node.textContent;
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

        // 4. Extract correct answers from .gi-answer elements
        const correctAnswerSpans = document.querySelectorAll('.gi-answer');
        if (correctAnswerSpans.length > 0) {
            let answerIndex = 0;

            for (const statement of contentData.statements) {
                if (statement.dropdowns) {
                    for (const dropdown of statement.dropdowns) {
                        if (correctAnswerSpans[answerIndex]) {
                            dropdown.correctAnswer = correctAnswerSpans[answerIndex].textContent.trim();
                            answerIndex++;
                        }
                    }
                }
            }
        }

        // 5. Metadata
        const metadata = extractGMATHeroMetadata();

        // Construct Final JSON
        const jsonData = {
            questionLink: getPracticeUrl(),
            source: 'GMAT HERO',
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
