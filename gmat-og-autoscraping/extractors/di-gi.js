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

        // 3. Extract Statements with Dropdowns
        // Supports both Practice Mode (select elements) and Review Mode (inline-result divs)
        var statements = [];

        // Check if we're in Practice Mode (has select elements) or Review Mode (has inline-results)
        var selectElements = questionContainer.querySelectorAll('select.question-choices-inline');
        var inlineResults = questionContainer.querySelectorAll('.inline-result');

        if (selectElements.length > 0) {
            // PRACTICE MODE: Extract from select elements
            var selectParagraphs = questionContainer.querySelectorAll('p:has(select.question-choices-inline)');

            selectParagraphs.forEach(function (p) {
                var dropdowns = [];

                // Clone the paragraph to manipulate
                var pClone = p.cloneNode(true);

                // Find all select elements in this paragraph
                var selects = pClone.querySelectorAll('select.question-choices-inline');

                selects.forEach(function (select) {
                    var options = [];

                    // Get all options (skip the "Select one" placeholder)
                    var optionEls = select.querySelectorAll('option');
                    optionEls.forEach(function (opt) {
                        var optText = opt.textContent.trim();
                        // Skip placeholder options like "Select one"
                        if (opt.value && opt.value !== '' && optText !== 'Select one') {
                            options.push(optText);
                        }
                    });

                    dropdowns.push({
                        options: options,
                        correctAnswer: null // Not available in practice mode
                    });

                    // Replace select with placeholder text
                    var placeholder = document.createTextNode('{dropdown}');
                    select.parentNode.replaceChild(placeholder, select);
                });

                // Get the text with placeholders
                var textContent = pClone.textContent.trim();
                // Clean up multiple spaces and &nbsp;
                textContent = textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

                var statement = {
                    text: decodeHtmlEntities(textContent),
                    dropdowns: dropdowns
                };

                if (statement.text) {
                    statements.push(statement);
                }
            });
        } else if (inlineResults.length > 0) {
            // REVIEW MODE: Extract from inline-result divs
            var statementParagraphs = questionContainer.querySelectorAll('p:has(.inline-result)');

            statementParagraphs.forEach(function (p) {
                var dropdowns = [];

                // Clone the paragraph to manipulate
                var pClone = p.cloneNode(true);

                // Find inline results in this paragraph
                var results = pClone.querySelectorAll('.inline-result');

                // Group inline-results that are adjacent (they represent one dropdown's options)
                // In GMAT OG, adjacent .inline-result divs before any text represent dropdown options
                var dropdownGroups = [];
                var currentGroup = [];
                var lastResult = null;

                results.forEach(function (result, index) {
                    // Check if this result is immediately after the previous one (same dropdown)
                    if (lastResult && result.previousSibling === lastResult) {
                        currentGroup.push(result);
                    } else if (lastResult && lastResult.nextSibling &&
                        lastResult.nextSibling.nodeType === 3 &&
                        lastResult.nextSibling.textContent.trim() === '' &&
                        lastResult.nextSibling.nextSibling === result) {
                        // Handle whitespace between adjacent results
                        currentGroup.push(result);
                    } else {
                        if (currentGroup.length > 0) {
                            dropdownGroups.push(currentGroup);
                        }
                        currentGroup = [result];
                    }
                    lastResult = result;
                });
                if (currentGroup.length > 0) {
                    dropdownGroups.push(currentGroup);
                }

                // Process each dropdown group
                dropdownGroups.forEach(function (group) {
                    var options = [];
                    var correctAnswer = null;

                    group.forEach(function (result) {
                        var answerText = result.textContent.trim();
                        options.push(answerText);

                        if (result.classList.contains('correct') || result.classList.contains('corrected')) {
                            // This is the correct answer
                            correctAnswer = answerText;
                        }
                    });

                    dropdowns.push({
                        options: options,
                        correctAnswer: correctAnswer
                    });
                });

                // Now build the statement text with {dropdown} placeholders
                // Replace each dropdown group with {dropdown}
                dropdownGroups.forEach(function (group) {
                    group.forEach(function (result, index) {
                        if (index === 0) {
                            // Replace first result with placeholder
                            var placeholder = document.createTextNode('{dropdown}');
                            result.parentNode.replaceChild(placeholder, result);
                        } else {
                            // Remove subsequent results in the group
                            result.parentNode.removeChild(result);
                        }
                    });
                });

                // Get the text with placeholders
                var textContent = pClone.textContent.trim();
                // Clean up multiple spaces
                textContent = textContent.replace(/\s+/g, ' ').trim();

                var statement = {
                    text: decodeHtmlEntities(textContent),
                    dropdowns: dropdowns
                };

                if (statement.text) {
                    statements.push(statement);
                }
            });
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
