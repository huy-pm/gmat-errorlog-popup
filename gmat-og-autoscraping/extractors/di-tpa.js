/**
 * GMAT OG Autoscraping - Two-Part Analysis (TPA) Extractor
 * Extracts DI questions with two-column selection
 */

import {
    decodeHtmlEntities,
    getCurrentUrl,
    extractQuestionId,
    processKaTeX
} from '../utils.js';

/**
 * Extract text from a node, handling KaTeX math elements properly
 * @param {Node} node - DOM node to extract text from
 * @returns {string} Extracted text with KaTeX converted to TeX notation
 */
function extractTextWithKaTeX(node) {
    var clone = node.cloneNode(true);
    if (clone.nodeType === Node.TEXT_NODE) {
        return clone.textContent;
    }
    if (clone.querySelectorAll) {
        processKaTeX(clone);
    }
    return clone.textContent;
}

/**
 * Extract Two-Part Analysis question data
 * @param {string} difficulty - Difficulty level from list page
 * @returns {Object|null} Question data or null if extraction fails
 */
export function extractQuestionData(difficulty = '') {
    try {
        var questionContainer = document.querySelector('#content-question-start');
        if (!questionContainer) {
            console.warn('No question container found');
            return null;
        }

        // 1. Extract Question Text (all paragraphs before the choice table)
        var questionParts = [];
        var paragraphs = questionContainer.querySelectorAll('p');

        paragraphs.forEach(function (p) {
            if (p.classList.contains('e_id')) return;
            var text = extractTextWithKaTeX(p).trim();
            if (text) {
                questionParts.push(text);
            }
        });

        var questionText = questionParts.join('\n\n');

        // 2. Extract Column Headers
        var columnHeaders = [];
        var table = questionContainer.querySelector('.question-choices-vertical');

        if (table) {
            var thead = table.querySelector('thead');
            if (thead) {
                var headerCells = thead.querySelectorAll('th.column-choice');
                headerCells.forEach(function (th) {
                    columnHeaders.push(extractTextWithKaTeX(th).trim());
                });
            }
        }

        // 3. Extract Rows with Choices
        var rows = [];
        var correctAnswers = {
            column1: null,
            column2: null
        };

        if (table) {
            var tbody = table.querySelector('tbody');
            if (tbody) {
                var tableRows = tbody.querySelectorAll('tr');

                tableRows.forEach(function (tr, rowIndex) {
                    var cells = tr.querySelectorAll('td');
                    var choiceContent = tr.querySelector('.choice-content');

                    if (choiceContent) {
                        var rowText = decodeHtmlEntities(extractTextWithKaTeX(choiceContent).trim());
                        var rowLetter = String.fromCharCode(65 + rowIndex); // A, B, C, etc.

                        rows.push({
                            text: rowText,
                            optionValue: rowLetter
                        });

                        // Check for correct answers in this row
                        var verticalChoices = tr.querySelectorAll('.vertical-choice');
                        verticalChoices.forEach(function (choice, colIndex) {
                            if (choice.classList.contains('correct')) {
                                if (colIndex === 0) {
                                    correctAnswers.column1 = rowLetter;
                                } else if (colIndex === 1) {
                                    correctAnswers.column2 = rowLetter;
                                }
                            }
                        });
                    }
                });
            }
        }

        // 4. Extract Question ID
        var questionId = extractQuestionId();

        // Construct Final JSON
        var jsonData = {
            questionLink: getCurrentUrl(),
            source: 'gmat-og',
            difficulty: difficulty,
            section: 'di',
            questionType: 'di',
            category: 'TPA',
            content: {
                questionText: decodeHtmlEntities(questionText),
                choiceLabels: columnHeaders,
                rows: rows,
                correctAnswers: correctAnswers
            }
        };

        if (questionId) {
            jsonData.questionId = questionId;
        }

        return jsonData;

    } catch (error) {
        console.error('Error extracting TPA Content:', error);
        return null;
    }
}

export default { extractQuestionData };
