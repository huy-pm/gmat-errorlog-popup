/**
 * GMAT OG Autoscraping - Data Sufficiency (DS) Extractor
 * Extracts DS questions with question text and two statements
 * Includes proper math LaTeX handling
 */

import {
    decodeHtmlEntities,
    getCurrentUrl,
    extractQuestionId,
    processKaTeX,
    escapeCurrencyInElement,
    normalizeCurrency
} from '../utils.js';

/**
 * Process a single element for math content
 * @param {Element} element - DOM element to process
 * @returns {string} Processed text content
 */
function processElementForMath(element) {
    if (!element) return '';

    // Clone the element to avoid modifying the original
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = element.innerHTML;

    // Escape currency before KaTeX processing
    escapeCurrencyInElement(tempDiv);

    // Process KaTeX
    processKaTeX(tempDiv);

    // Get text and clean whitespace
    var text = tempDiv.textContent || '';
    text = text.replace(/\s+/g, ' ').trim();

    return normalizeCurrency(decodeHtmlEntities(text));
}

/**
 * Extract Data Sufficiency question data
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

        // 1. Extract Image FIRST (before any processing)
        var image = null;
        var imgEl = questionContainer.querySelector('img');
        if (imgEl) {
            var src = imgEl.getAttribute('src');
            if (src && src.startsWith('//')) {
                src = 'https:' + src;
            }
            image = src;
        }

        // 2. Extract Question Text and Statements
        var questionText = '';
        var statement1 = '';
        var statement2 = '';
        var paragraphs = questionContainer.querySelectorAll('p');
        var questionParts = [];

        // First, try to find statements using class selectors (format 1)
        var stmt1El = questionContainer.querySelector('.ds-statement1');
        var stmt2El = questionContainer.querySelector('.ds-statement2');

        if (stmt1El) {
            statement1 = processElementForMath(stmt1El);
        }
        if (stmt2El) {
            statement2 = processElementForMath(stmt2El);
        }

        // Process paragraphs for question text and fallback statement extraction
        for (var i = 0; i < paragraphs.length; i++) {
            var p = paragraphs[i];
            if (p.classList.contains('e_id')) continue;
            if (p.classList.contains('ds-statement1')) continue;
            if (p.classList.contains('ds-statement2')) continue;
            // Skip paragraphs that only contain images
            if (p.querySelector('img') && !p.textContent.trim()) continue;

            var text = processElementForMath(p);
            if (!text) continue;

            // Check if this paragraph is a statement (format 2: starts with "(1)" or "(2)")
            if (text.match(/^\s*\(1\)/)) {
                // This is statement 1 - only use if not found via class
                if (!statement1) {
                    statement1 = text;
                }
            } else if (text.match(/^\s*\(2\)/)) {
                // This is statement 2 - only use if not found via class
                if (!statement2) {
                    statement2 = text;
                }
            } else {
                // This is part of the question text (not a statement paragraph)
                questionParts.push(text);
            }
        }

        // Join question parts
        questionText = questionParts.join('\n\n');

        // 4. Extract Correct Answer
        var correctAnswer = '';

        var choicesContainer = questionContainer.querySelector('.question-choices-multi');
        if (choicesContainer) {
            var choices = choicesContainer.querySelectorAll('li');
            choices.forEach(function (choice) {
                var multiChoice = choice.querySelector('.multi-choice');

                if (multiChoice) {
                    if (multiChoice.classList.contains('correct') ||
                        multiChoice.classList.contains('corrected')) {
                        correctAnswer = multiChoice.getAttribute('data-choice') || '';
                    }
                }
            });
        }

        // 5. Extract Question ID
        var questionId = extractQuestionId();

        // Construct Final JSON (matching GMAT Hero format)
        var jsonData = {
            questionLink: getCurrentUrl(),
            source: 'gmat-og',
            difficulty: difficulty,
            section: 'di',
            questionType: 'di',
            category: 'DS',
            correctAnswer: correctAnswer,
            content: {
                questionText: questionText,
                statements: [statement1, statement2],
                image: image
            }
        };

        if (questionId) {
            jsonData.questionId = questionId;
        }

        return jsonData;

    } catch (error) {
        console.error('Error extracting DS Content:', error);
        return null;
    }
}

export default { extractQuestionData };
