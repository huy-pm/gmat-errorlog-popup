/**
 * GMAT Hero Autoscraping - Reading Comprehension Extractor
 * Extracts RC questions with passage and highlighted text
 */

import {
    decodeHtmlEntities,
    convertHighlightedTextToMarkdown,
    extractHighlightRanges,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../utils.js';

/**
 * Extract Reading Comprehension question data
 * @returns {Object|null} Question data or null if extraction fails
 */
export async function extractQuestionData() {
    try {
        // Extract passage from left panel
        const leftPanel = document.getElementById('left-panel');
        if (!leftPanel) {
            console.warn('Could not find left-panel element!');
            return null;
        }

        const passageEl = leftPanel.querySelector('.passage');
        if (!passageEl) {
            console.warn('Could not find passage element!');
            return null;
        }

        // Clone and process passage
        const passageDiv = document.createElement('div');
        passageDiv.innerHTML = passageEl.innerHTML;

        // Convert highlighted text to markdown
        let passageHtml = convertHighlightedTextToMarkdown(passageDiv.innerHTML);

        // Replace <br> and <p> tags with newlines
        passageHtml = passageHtml.replace(/<br\s*\/?>/gi, '\n');
        passageHtml = passageHtml.replace(/<\/p>\s*<p>/gi, '\n\n');
        passageHtml = passageHtml.replace(/<\/?p>/gi, '');

        passageDiv.innerHTML = passageHtml;
        let passageText = passageDiv.textContent;
        passageText = passageText.split('\n').map(line => line.trim()).join('\n');
        passageText = passageText.replace(/\n{3,}/g, '\n\n').trim();

        // Extract highlight ranges
        const { cleanText: cleanPassage, highlightRanges } = extractHighlightRanges(passageText);

        // Extract question from right panel
        const rightPanel = document.getElementById('right-panel');
        if (!rightPanel) {
            console.warn('Could not find right-panel element!');
            return null;
        }

        const questionStem = rightPanel.querySelector('.question-stem');
        if (!questionStem) {
            console.warn('Could not find question-stem element!');
            return null;
        }

        // Process question
        const questionDiv = document.createElement('div');
        questionDiv.innerHTML = questionStem.innerHTML;

        // Replace <br> tags with newlines
        let questionHtml = questionDiv.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        questionDiv.innerHTML = questionHtml;

        let questionText = questionDiv.textContent;
        questionText = questionText.split('\n').map(line => line.trim()).join('\n');
        questionText = questionText.replace(/\n{3,}/g, '\n\n').trim();

        // Extract answer choices
        const answerChoices = [];
        const standardChoices = rightPanel.querySelector('.standard-choices');

        if (standardChoices) {
            const options = standardChoices.querySelectorAll('.option');

            options.forEach(function (option) {
                const label = option.querySelector('label');
                if (label) {
                    let answerText = label.textContent.trim();
                    // Remove answer letter prefix
                    answerText = answerText.replace(/^[A-Ea-e][.)\s]+/, '').trim();
                    if (answerText) {
                        answerChoices.push(answerText);
                    }
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
            section: 'verbal',
            questionType: 'rc',
            category: 'RC',
            correctAnswer: metadata.correctAnswer || '',
            content: {
                passage: decodeHtmlEntities(cleanPassage || passageText),
                highlightRanges: highlightRanges.length > 0 ? highlightRanges : undefined,
                questionText: decodeHtmlEntities(questionText),
                answerChoices: answerChoices.map(choice => decodeHtmlEntities(choice))
            }
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting RC content:', error);
        return null;
    }
}

export default { extractQuestionData };
