/**
 * GMAT Hero Autoscraping - Quant Extractor
 * Extracts Quantitative questions
 */

import {
    decodeHtmlEntities,
    escapeCurrencyInElement,
    normalizeCurrency,
    processKaTeX,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../utils.js';

/**
 * Check if this is a Data Sufficiency question (to skip)
 * Pattern: <br>(1) and <br>(2)
 * @param {string} html - Question HTML
 * @returns {boolean} True if DS question
 */
function isDataSufficiencyQuestion(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const brTags = tempDiv.querySelectorAll('br');
    let dsPattern = 0;

    brTags.forEach(function (br) {
        const nextNode = br.nextSibling;
        if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
            const text = nextNode.textContent.trim();
            if (text.match(/^\(1\)\s*/) || text.match(/^\(2\)\s*/)) {
                dsPattern++;
            }
        }
    });

    return dsPattern >= 2;
}

/**
 * Extract Quant question data
 * @returns {Object|null} Question data or null if extraction fails
 */
export async function extractQuestionData() {
    try {
        const rightPanel = document.getElementById('right-panel');
        if (!rightPanel) {
            console.warn('Could not find GMAT Hero right-panel element!');
            return null;
        }

        const questionStem = rightPanel.querySelector('.question-stem');
        if (!questionStem) {
            console.warn('Could not find GMAT Hero question-stem element!');
            return null;
        }

        // Check if this is a Data Sufficiency question (skip these)
        if (isDataSufficiencyQuestion(questionStem.innerHTML)) {
            console.log('Skipping Data Sufficiency question');
            return null;
        }

        // Extract image if exists
        let questionImage = null;
        const imgElement = questionStem.querySelector('img');
        if (imgElement) {
            questionImage = imgElement.src;
        }

        // Clone and process question stem
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = questionStem.innerHTML;

        // Replace <br> tags with newlines
        let htmlWithLineBreaks = tempDiv.innerHTML;
        htmlWithLineBreaks = htmlWithLineBreaks.replace(/<br\s*\/?>/gi, '\n');
        tempDiv.innerHTML = htmlWithLineBreaks;

        // IMPORTANT: Escape currency symbols BEFORE processing KaTeX
        escapeCurrencyInElement(tempDiv);

        // Process KaTeX math expressions
        processKaTeX(tempDiv);

        // Get text content and clean up
        let questionText = tempDiv.textContent;
        questionText = questionText.split('\n').map(line => line.trim()).join('\n');
        questionText = questionText.replace(/\n{3,}/g, '\n\n').trim();

        // Extract answer choices
        const answerChoices = [];
        const standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');

        if (standardChoices) {
            const options = standardChoices.querySelectorAll('.option.ng-star-inserted, .option');

            options.forEach(function (option) {
                let answerText = '';

                const label = option.querySelector('label');
                if (label) {
                    const katexElements = label.querySelectorAll('.katex');
                    if (katexElements.length > 0) {
                        const labelDiv = document.createElement('div');
                        labelDiv.innerHTML = label.innerHTML;

                        // Escape currency before KaTeX
                        escapeCurrencyInElement(labelDiv);

                        // Process KaTeX
                        processKaTeX(labelDiv);

                        answerText = labelDiv.textContent.trim();
                    } else {
                        const span = label.querySelector('span');
                        if (span) {
                            answerText = span.textContent.trim();
                        } else {
                            answerText = label.textContent.trim();
                        }
                    }
                } else {
                    answerText = option.textContent.trim();
                }

                if (answerText) {
                    // Remove answer letter prefix (A., B., etc.)
                    answerText = answerText.replace(/^[A-Ea-e][.)\s]+/, '').trim();
                    answerChoices.push(answerText);
                }
            });
        }

        // Extract metadata
        const metadata = extractGMATHeroMetadata();

        // Create JSON structure
        const jsonData = {
            questionLink: getPracticeUrl(),
            source: 'GMAT HERO',
            difficulty: metadata.difficulty || '',
            section: 'quant',
            questionType: 'quant',
            correctAnswer: metadata.correctAnswer || '',
            category: metadata.category || '',
            content: {
                questionText: normalizeCurrency(decodeHtmlEntities(questionText)),
                answerChoices: answerChoices.map(choice => normalizeCurrency(choice)),
                image: questionImage
            }
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting Quant content:', error);
        return null;
    }
}

export default { extractQuestionData };
