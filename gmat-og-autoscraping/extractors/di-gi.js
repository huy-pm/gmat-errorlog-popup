/**
 * GMAT OG Autoscraping - Graphics Interpretation (GI) Extractor
 * Extracts DI questions with graphs/charts and dropdown selections
 */

import {
    decodeHtmlEntities,
    getCurrentUrl,
    extractQuestionId
} from '../utils.js';

/**
 * Extract Graphics Interpretation question data
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

        // 1. Extract Image
        var image = null;
        var imgEl = questionContainer.querySelector('img');
        if (imgEl) {
            var src = imgEl.getAttribute('src');
            // Normalize protocol-relative URLs
            if (src && src.startsWith('//')) {
                src = 'https:' + src;
            }
            image = src;
        }

        // 2. Extract Question Text (paragraphs before the dropdowns)
        var paragraphs = questionContainer.querySelectorAll('p');
        var questionParts = [];

        paragraphs.forEach(function (p) {
            // Skip e_id paragraph
            if (p.classList.contains('e_id')) return;
            // Skip paragraphs that only contain images
            if (p.querySelector('img') && !p.textContent.trim()) return;

            var text = p.textContent.trim();
            if (text) {
                questionParts.push(text);
            }
        });

        var questionText = questionParts.join('\n\n');

        // 3. Extract Statements with Dropdown Results (Review Mode)
        var statements = [];
        var inlineResults = questionContainer.querySelectorAll('.inline-result');

        // Process inline results in groups
        // Pattern: text before dropdown, dropdown result, text after
        var currentStatement = {
            text: '',
            options: [],
            correctAnswer: null,
            userAnswer: null
        };

        // Find all paragraphs containing inline-results (the actual question statements)
        var statementParagraphs = questionContainer.querySelectorAll('p:has(.inline-result)');

        statementParagraphs.forEach(function (p) {
            var statement = {
                text: '',
                options: [],
                correctAnswer: null,
                userAnswer: null
            };

            // Get the full text content
            var fullText = p.innerHTML;

            // Find inline results in this paragraph
            var results = p.querySelectorAll('.inline-result');

            results.forEach(function (result) {
                var answerText = result.textContent.trim();

                if (result.classList.contains('correct')) {
                    statement.correctAnswer = answerText;
                    statement.userAnswer = answerText;
                } else if (result.classList.contains('corrected')) {
                    statement.correctAnswer = answerText;
                } else if (result.classList.contains('incorrect')) {
                    statement.userAnswer = answerText;
                }
            });

            // Replace inline-result divs with placeholders to get statement text
            var textContent = p.textContent.trim();
            statement.text = decodeHtmlEntities(textContent);

            if (statement.text) {
                statements.push(statement);
            }
        });

        // 4. Extract Question ID
        var questionId = extractQuestionId();

        // Construct Final JSON
        var jsonData = {
            questionLink: getCurrentUrl(),
            source: 'GMAT Official',
            difficulty: difficulty,
            section: 'di',
            questionType: 'di',
            category: 'GI',
            content: {
                image: image,
                questionText: decodeHtmlEntities(questionText),
                statements: statements
            }
        };

        if (questionId) {
            jsonData.questionId = questionId;
        }

        return jsonData;

    } catch (error) {
        console.error('Error extracting GI Content:', error);
        return null;
    }
}

export default { extractQuestionData };
