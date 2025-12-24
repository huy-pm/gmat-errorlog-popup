/**
 * GMAT OG Autoscraping - Multi-Source Reasoning (MSR) Extractor
 * Extracts DI questions with tabbed data sources
 * Format matches GMAT Hero MSR structure
 */

import {
    decodeHtmlEntities,
    getCurrentUrl,
    extractQuestionId
} from '../utils.js';

/**
 * Extract Multi-Source Reasoning question data
 * @param {string} difficulty - Difficulty level from list page
 * @returns {Object|null} Question data or null if extraction fails
 */
export function extractQuestionData(difficulty = '') {
    try {
        var questionContainer = document.querySelector('#content-question-start');
        var passageContainer = document.querySelector('.reading-passage');

        if (!questionContainer) {
            console.warn('No question container found');
            return null;
        }

        // 1. Extract Data Sources (Tabs)
        var dataSources = { tabs: [] };
        var tabNames = [];

        // Get tab buttons
        var tabButtons = document.querySelectorAll('.btn-group .content-tab-link');
        var tabPanels = document.querySelectorAll('.content-tab');

        tabButtons.forEach(function (tabBtn, index) {
            var tabName = tabBtn.textContent.trim();
            tabNames.push(tabName);
            var panel = tabPanels[index];

            var content = {
                text: '',
                table: null,
                images: []
            };

            if (panel) {
                // Extract images
                var images = panel.querySelectorAll('img');
                images.forEach(function (img) {
                    var src = img.getAttribute('src');
                    if (src) {
                        if (src.startsWith('//')) {
                            src = 'https:' + src;
                        }
                        content.images.push(src);
                    }
                });

                // Extract text content
                var paragraphs = panel.querySelectorAll('p');
                var textParts = [];
                paragraphs.forEach(function (p) {
                    var text = p.textContent.trim();
                    if (text && !p.querySelector('img')) {
                        textParts.push(text);
                    }
                });
                content.text = textParts.join('\n');
            }

            dataSources.tabs.push({
                name: tabName,
                content: content
            });
        });

        // 2. Extract Question Text
        var questionText = '';
        var eIdEl = questionContainer.querySelector('p.e_id');
        var paragraphs = questionContainer.querySelectorAll('p');

        paragraphs.forEach(function (p) {
            if (p === eIdEl) return;
            var text = p.textContent.trim();
            if (text && !p.querySelector('.table-choice') && !p.querySelector('.multi-choice')) {
                questionText = text;
            }
        });

        // 3. Extract Question Type and Build Question Object
        var question = {
            questionText: decodeHtmlEntities(questionText),
            questionType: null,
            questionId: 1, // Single question per page
            questionLink: getCurrentUrl(),
            difficulty: difficulty.toLowerCase()
        };

        // Check for binary choice table (.question-choices-table)
        var binaryTable = questionContainer.querySelector('.question-choices-table');
        if (binaryTable) {
            question.questionType = 'binary';
            question.statements = [];

            // Extract choice labels from first row first
            var firstRow = binaryTable.querySelector('li[data-index="0"]');
            if (firstRow) {
                var labels = [];
                var choices = firstRow.querySelectorAll('.table-choice');
                choices.forEach(function (c) {
                    labels.push(c.textContent.trim());
                });
                if (labels.length >= 2) {
                    question.choiceLabels = labels;
                }
            }

            var rows = binaryTable.querySelectorAll('li[data-index]');
            rows.forEach(function (row) {
                var choiceA = row.querySelector('.table-choice[data-choice="A"]');
                var choiceB = row.querySelector('.table-choice[data-choice="B"]');
                var choiceContent = row.querySelector('.choice-content');

                var statement = {
                    text: choiceContent ? decodeHtmlEntities(choiceContent.textContent.trim()) : '',
                    correctAnswer: null
                };

                // Determine correct answer from classes
                [choiceA, choiceB].forEach(function (choice) {
                    if (!choice) return;
                    var answerText = choice.textContent.trim();

                    if (choice.classList.contains('correct') || choice.classList.contains('corrected')) {
                        statement.correctAnswer = answerText;
                    }
                });

                question.statements.push(statement);
            });
        }

        // Check for multiple choice (.question-choices-multi)
        var mcContainer = questionContainer.querySelector('.question-choices-multi');
        if (mcContainer) {
            question.questionType = 'multipleChoice';
            question.options = [];
            question.correctAnswer = null;

            var choices = mcContainer.querySelectorAll('li');
            choices.forEach(function (choice) {
                var multiChoice = choice.querySelector('.multi-choice');
                var choiceContent = choice.querySelector('.choice-content');

                if (multiChoice && choiceContent) {
                    var letter = multiChoice.getAttribute('data-choice') || '';
                    var text = decodeHtmlEntities(choiceContent.textContent.trim());
                    var isCorrect = multiChoice.classList.contains('correct') ||
                        multiChoice.classList.contains('corrected');

                    question.options.push({
                        letter: letter,
                        text: text,
                        isCorrect: isCorrect
                    });

                    if (isCorrect) {
                        question.correctAnswer = letter;
                    }
                }
            });
        }

        // 4. Extract Question ID from page (for the question set)
        var pageQuestionId = extractQuestionId();

        // 5. Create tab signature
        var tabSignature = tabNames.join('|');

        // Construct Final JSON matching GMAT Hero format
        var jsonData = {
            questionSetLink: getCurrentUrl(),
            source: 'GMAT Official',
            section: 'di',
            questionType: 'di',
            category: 'msr',
            dataSources: dataSources,
            questions: [question],
            _tabSignature: tabSignature
        };

        if (pageQuestionId) {
            jsonData.questionId = pageQuestionId;
        }

        return jsonData;

    } catch (error) {
        console.error('Error extracting MSR Content:', error);
        return null;
    }
}

export default { extractQuestionData };
