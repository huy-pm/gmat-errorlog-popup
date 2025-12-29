/**
 * GMAT Hero Autoscraping - Two-Part Analysis (TPA) Extractor
 * Extracts DI questions with two-column selection
 */

import {
    decodeHtmlEntities,
    escapeCurrencyInElement,
    normalizeCurrency,
    processKaTeX,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../gmat-hero-utils.js';

/**
 * Extract Two-Part Analysis question data
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

        // 1. Extract Question Text (with KaTeX processing)
        let htmlWithLineBreaks = questionStem.innerHTML;
        htmlWithLineBreaks = htmlWithLineBreaks.replace(/<br\s*\/?>/gi, '\n');

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlWithLineBreaks;

        // Process KaTeX math expressions
        escapeCurrencyInElement(tempDiv);
        processKaTeX(tempDiv);

        let questionText = normalizeCurrency(tempDiv.textContent.trim());
        questionText = questionText.split('\n').map(l => l.trim()).join('\n');
        questionText = questionText.replace(/\n{3,}/g, '\n\n').trim();

        // 2. Find TPA Question Container
        const tpaQuestion = document.querySelector('.tpa-question');
        if (!tpaQuestion) {
            console.warn('No TPA question container found');
            return null;
        }

        // 3. Extract Column Headers (with KaTeX processing)
        const choiceLabels = [];
        const headerElements = tpaQuestion.querySelectorAll('.grid-item.center > b');
        headerElements.forEach(header => {
            const headerClone = header.cloneNode(true);
            escapeCurrencyInElement(headerClone);
            processKaTeX(headerClone);
            choiceLabels.push(normalizeCurrency(headerClone.textContent.trim()));
        });

        // 4. Extract Rows
        // The structure is: header, header, empty, radio, radio, text, radio, radio, text, ...
        const allGridItems = Array.from(tpaQuestion.querySelectorAll('.grid-item'));
        const rows = [];

        // Skip first 2 headers and 1 empty div (indices 0, 1, 2)
        // Then iterate through groups of 3: radio-part1, radio-part2, text
        for (let i = 3; i < allGridItems.length; i += 3) {
            const radioPart1 = allGridItems[i];
            const radioPart2 = allGridItems[i + 1];
            const textElement = allGridItems[i + 2];

            if (!textElement) break;

            // Get the option value from the radio input
            const radioInput = radioPart1.querySelector('input[type="radio"]');
            const optionValue = radioInput ? radioInput.value : '';

            // Process KaTeX in row text
            const textClone = textElement.cloneNode(true);
            escapeCurrencyInElement(textClone);
            processKaTeX(textClone);
            const rowText = normalizeCurrency(textClone.textContent.trim());

            rows.push({
                text: rowText,
                optionValue: optionValue
            });
        }

        // 5. Extract Correct Answers
        const correctAnswers = {
            column1: null,
            column2: null
        };

        // Find correct answer for column 1 (part-1)
        const correctPart1 = tpaQuestion.querySelector('p-radiobutton.correct-answer[name="part-1"] input');
        if (correctPart1) {
            correctAnswers.column1 = correctPart1.value;
        }

        // Find correct answer for column 2 (part-2)
        const correctPart2 = tpaQuestion.querySelector('p-radiobutton.correct-answer[name="part-2"] input');
        if (correctPart2) {
            correctAnswers.column2 = correctPart2.value;
        }

        // 6. Metadata
        const metadata = extractGMATHeroMetadata();

        // Construct Final JSON
        const jsonData = {
            questionLink: getPracticeUrl(),
            source: 'gmat-hero',
            difficulty: metadata.difficulty || '',
            section: 'di',
            questionType: 'di',
            category: 'TPA',
            content: {
                questionText: decodeHtmlEntities(questionText),
                choiceLabels: choiceLabels,
                rows: rows,
                correctAnswers: correctAnswers
            }
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting TPA Content:', error);
        return null;
    }
}

export default { extractQuestionData };
