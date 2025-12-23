/**
 * GMAT OG Autoscraping - Table Analysis (TA) Extractor
 * Extracts DI questions with sortable tables and binary statements
 */

import {
    decodeHtmlEntities,
    getCurrentUrl,
    extractQuestionId
} from '../utils.js';

/**
 * Extract Table Analysis question data
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

        // 1. Extract Intro Text (paragraph before table)
        var introText = '';
        var paragraphs = questionContainer.querySelectorAll('p');
        paragraphs.forEach(function (p) {
            if (p.classList.contains('e_id')) return;
            var text = p.textContent.trim();
            // Get first substantial paragraph as intro
            if (text && !introText && !p.querySelector('img')) {
                introText = text;
            }
        });

        // 2. Extract Table Data
        var tableData = {
            headers: [],
            rows: []
        };

        var table = questionContainer.querySelector('.table-sortable');
        if (table) {
            // Extract headers
            var thead = table.querySelector('thead');
            if (thead) {
                var headerCells = thead.querySelectorAll('th');
                headerCells.forEach(function (th) {
                    var headerInner = th.querySelector('.tablesorter-header-inner');
                    var text = headerInner ? headerInner.textContent.trim() : th.textContent.trim();
                    if (text) {
                        tableData.headers.push(text);
                    }
                });
            }

            // Extract rows
            var tbody = table.querySelector('tbody');
            if (tbody) {
                var tableRows = tbody.querySelectorAll('tr');
                tableRows.forEach(function (tr) {
                    var rowData = [];
                    var cells = tr.querySelectorAll('td');
                    cells.forEach(function (td) {
                        // Get text, handling italic text
                        var text = td.textContent.trim();
                        rowData.push(text);
                    });
                    if (rowData.length > 0) {
                        tableData.rows.push(rowData);
                    }
                });
            }
        }

        // 3. Extract Question Instruction
        var questionInstruction = '';
        // Find the paragraph after the table that contains the instruction
        var allParagraphs = Array.from(questionContainer.querySelectorAll('p'));
        for (var i = 0; i < allParagraphs.length; i++) {
            var text = allParagraphs[i].textContent.trim();
            if (text.includes('select') && (text.includes('Yes') || text.includes('No'))) {
                questionInstruction = text;
                break;
            }
        }

        // 4. Extract Binary Choice Statements (Yes/No)
        var statements = [];
        var choiceLabels = ['Yes', 'No'];

        var binaryTable = questionContainer.querySelector('.question-choices-table');
        if (binaryTable) {
            var rows = binaryTable.querySelectorAll('li[data-index]');

            // Extract choice labels from first row
            var firstRow = binaryTable.querySelector('li[data-index="0"]');
            if (firstRow) {
                var choices = firstRow.querySelectorAll('.table-choice');
                if (choices.length >= 2) {
                    choiceLabels = [
                        choices[0].textContent.trim(),
                        choices[1].textContent.trim()
                    ];
                }
            }

            rows.forEach(function (row) {
                var choiceA = row.querySelector('.table-choice[data-choice="A"]');
                var choiceB = row.querySelector('.table-choice[data-choice="B"]');
                var choiceContent = row.querySelector('.choice-content');

                var statement = {
                    text: choiceContent ? decodeHtmlEntities(choiceContent.textContent.trim()) : '',
                    correctAnswer: null
                };

                // Determine correct answer from classes
                if (choiceA && (choiceA.classList.contains('correct') || choiceA.classList.contains('corrected'))) {
                    statement.correctAnswer = choiceLabels[0];
                } else if (choiceB && (choiceB.classList.contains('correct') || choiceB.classList.contains('corrected'))) {
                    statement.correctAnswer = choiceLabels[1];
                }

                statements.push(statement);
            });
        }

        // 5. Extract Question ID
        var questionId = extractQuestionId();

        // Construct Final JSON
        var jsonData = {
            questionLink: getCurrentUrl(),
            source: 'GMAT Official',
            difficulty: difficulty,
            section: 'di',
            questionType: 'di',
            category: 'TA',
            content: {
                introText: decodeHtmlEntities(introText),
                table: tableData,
                questionInstruction: decodeHtmlEntities(questionInstruction),
                choiceLabels: choiceLabels,
                statements: statements
            }
        };

        if (questionId) {
            jsonData.questionId = questionId;
        }

        return jsonData;

    } catch (error) {
        console.error('Error extracting TA Content:', error);
        return null;
    }
}

export default { extractQuestionData };
