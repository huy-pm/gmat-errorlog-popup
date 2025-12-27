/**
 * GMAT Hero Autoscraping - Critical Reasoning Extractor
 * Extracts CR questions with passage/question split
 */

import {
    decodeHtmlEntities,
    convertStyledSpansToMarkdown,
    convertBoldItalicToMarkdown,
    isCompletionStyleQuestion,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../utils.js';

/**
 * Patterns that indicate where to split passage from question
 */
const QUESTION_PATTERNS = [
    /Which of the following/i,
    /Which one of the following/i,
    /What is the/i,
    /The argument is most vulnerable/i,
    /The reasoning in the argument/i,
    /The claim that/i,
    /The author's reasoning/i,
    /The passage provides/i,
    /The conclusion drawn/i,
    /In order to evaluate/i,
    /The evidence cited/i,
    /The statements above/i,
    /The information above/i,
    /The facts above/i,
    /Based on the passage/i,
    /According to the passage/i
];

/**
 * Find the split point between passage and question
 * @param {string} text - Full text content
 * @returns {{ passage: string, question: string }}
 */
function splitPassageAndQuestion(text) {
    if (!text) return { passage: '', question: text };

    // Try to find a question pattern
    for (const pattern of QUESTION_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            const splitIndex = text.indexOf(match[0]);
            if (splitIndex > 50) { // Ensure passage has reasonable length
                return {
                    passage: text.substring(0, splitIndex).trim(),
                    question: text.substring(splitIndex).trim()
                };
            }
        }
    }

    // Check for sentence completion style (ends with specific patterns)
    if (isCompletionStyleQuestion(text)) {
        // For completion style, the entire text is the "question"
        // Try to find the last sentence before the completion pattern
        const sentences = text.split(/(?<=[.!?])\s+/);
        if (sentences.length > 1) {
            const lastSentence = sentences[sentences.length - 1];
            const passage = sentences.slice(0, -1).join(' ');
            return {
                passage: passage.trim(),
                question: lastSentence.trim()
            };
        }
    }

    // Default: no clear split, return all as passage with empty question
    return { passage: text.trim(), question: '' };
}

/**
 * Extract Critical Reasoning question data
 * @returns {Object|null} Question data or null if extraction fails
 */
export async function extractQuestionData() {
    try {
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

        // Extract metadata first to check question type (like the working autoscraping script)
        const metadata = extractGMATHeroMetadata();
        const isBoldfaceQuestion = metadata.category && metadata.category.toLowerCase().includes('boldface');
        const isCompleteArgumentQuestion = metadata.category && metadata.category.toLowerCase().includes('complete');

        // Clone and process
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = questionStem.innerHTML;

        let processedHtml = tempDiv.innerHTML;

        // Only convert bold/italic to markdown for boldface and complete argument questions
        // This matches the behavior of the working gmat-hero-cr-autoscraping.js
        if (isBoldfaceQuestion || isCompleteArgumentQuestion) {
            // Use convertBoldItalicToMarkdown which handles <b>, <i>, <strong>, <em>, and styled <span> tags
            processedHtml = convertBoldItalicToMarkdown(processedHtml);
        }

        // Replace <br> tags with newlines
        processedHtml = processedHtml.replace(/<br\s*\/?>/gi, '\n\n');
        tempDiv.innerHTML = processedHtml;

        // Get text content and clean up
        let stemContent = tempDiv.textContent;
        stemContent = stemContent.split('\n').map(line => line.trim()).join('\n');
        stemContent = stemContent.replace(/\n{3,}/g, '\n\n').trim();

        // Split passage and question
        const { passage, question } = splitPassageAndQuestion(stemContent);

        // Extract answer choices
        const answerChoices = [];
        const standardChoices = rightPanel.querySelector('.standard-choices');

        if (standardChoices) {
            const options = standardChoices.querySelectorAll('.option');

            options.forEach(function (option) {
                const label = option.querySelector('label');
                if (label) {
                    let answerHtml = label.innerHTML;
                    // Convert styled spans in answers too
                    answerHtml = convertStyledSpansToMarkdown(answerHtml);

                    const answerDiv = document.createElement('div');
                    answerDiv.innerHTML = answerHtml;
                    let answerText = answerDiv.textContent.trim();

                    // Remove answer letter prefix
                    answerText = answerText.replace(/^[A-Ea-e][.)\s]+/, '').trim();

                    if (answerText) {
                        answerChoices.push(answerText);
                    }
                }
            });
        }

        // Note: metadata was already extracted earlier to check for Boldface questions
        // Determine if this is a completion style question
        const needsCompletion = isCompletionStyleQuestion(question) ||
            (!question.endsWith('?') && question.length > 0);

        // Create JSON structure
        const jsonData = {
            questionLink: getPracticeUrl(),
            source: 'GMAT HERO',
            difficulty: metadata.difficulty || '',
            section: 'verbal',
            questionType: 'cr',
            category: 'CR',
            correctAnswer: metadata.correctAnswer || '',
            content: {
                passage: decodeHtmlEntities(passage),
                questionText: decodeHtmlEntities(question),
                answerChoices: answerChoices.map(choice => decodeHtmlEntities(choice)),
                isCompletionStyle: needsCompletion
            }
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting CR content:', error);
        return null;
    }
}

export default { extractQuestionData };
