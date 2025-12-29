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
} from '../gmat-hero-utils.js';

/**
 * Keywords that indicate a sentence with ? is likely a question (not just a quote)
 */
const QUESTION_KEYWORDS = [
    'which', 'what', 'how', 'why', 'except',
    'vulnerable', 'flaw', 'assumption', 'conclusion',
    'inference', 'strengthen', 'weaken'
];

/**
 * Check if text likely contains a question based on keywords
 */
function hasQuestionKeywords(text) {
    const lowerText = text.toLowerCase();
    return QUESTION_KEYWORDS.some(keyword => lowerText.includes(keyword));
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

        // Check for boldface question: either in metadata category OR in question stem content
        const stemText = questionStem.textContent.toLowerCase();
        const isBoldfaceQuestion = (metadata.category && metadata.category.toLowerCase().includes('boldface')) ||
            stemText.includes('boldface') || stemText.includes('bold face');

        // Check for complete argument question: either in metadata OR by presence of blanks
        const isCompleteArgumentQuestion = (metadata.category && metadata.category.toLowerCase().includes('complete')) ||
            questionStem.innerHTML.includes('_____') || questionStem.innerHTML.includes('________');

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

        // STRUCTURE-FIRST APPROACH: Split by <br> tags to get natural boundaries
        // This respects GMAT Hero's HTML structure where passage and question are separated by <br><br>
        const parts = processedHtml.split(/<br\s*\/?>/gi);

        let passage = '';
        let question = '';

        if (isCompleteArgumentQuestion) {
            // Complete-the-Argument: Question (with ?) comes FIRST, then passage (with _____)
            let questionPartIndex = -1;
            let passagePartIndex = -1;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i].trim();
                if (part.length > 0) {
                    // Strip HTML tags for analysis
                    const cleanPart = part.replace(/<[^>]*>/g, '').trim();

                    if (cleanPart.includes('?') && questionPartIndex === -1) {
                        questionPartIndex = i;
                        question = cleanPart;
                    } else if (cleanPart.includes('_____') || cleanPart.includes('________')) {
                        passagePartIndex = i;
                        passage = cleanPart;
                    }
                }
            }

            // If we only found passage with blanks, use default question
            if (passagePartIndex >= 0 && questionPartIndex === -1) {
                passage = parts.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 0).join(' ');
                question = 'Which of the following most logically completes the argument?';
            }
        } else {
            // Standard CR: Iterate from end to find question part (with ? and keywords)
            let questionIndex = -1;

            // First pass: find part with ? and question keywords
            for (let i = parts.length - 1; i >= 0; i--) {
                const part = parts[i].trim();
                if (part.length > 0) {
                    const cleanPart = part.replace(/<[^>]*>/g, '').trim();

                    if (cleanPart.includes('?') && hasQuestionKeywords(cleanPart)) {
                        questionIndex = i;
                        question = cleanPart;
                        break;
                    }
                }
            }

            // Second pass: fallback to any part with ?
            if (questionIndex === -1) {
                for (let i = parts.length - 1; i >= 0; i--) {
                    const part = parts[i].trim();
                    if (part.length > 0) {
                        const cleanPart = part.replace(/<[^>]*>/g, '').trim();
                        if (cleanPart.includes('?')) {
                            questionIndex = i;
                            question = cleanPart;
                            break;
                        }
                    }
                }
            }

            // Third pass: check for sentence-completion style (no ?)
            if (questionIndex === -1) {
                for (let i = parts.length - 1; i >= 0; i--) {
                    const part = parts[i].trim();
                    if (part.length > 0) {
                        const cleanPart = part.replace(/<[^>]*>/g, '').trim();
                        if (isCompletionStyleQuestion(cleanPart)) {
                            questionIndex = i;
                            question = cleanPart;
                            console.log('Detected sentence-completion question pattern:', cleanPart);
                            break;
                        }
                    }
                }
            }

            // Build passage from parts before question
            if (questionIndex >= 0) {
                const passageParts = parts.slice(0, questionIndex);
                passage = passageParts
                    .map(p => p.replace(/<[^>]*>/g, '').trim())
                    .filter(p => p.length > 0)
                    .join(' ');
            } else {
                // No question found - treat entire content as passage
                passage = parts.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 0).join(' ');
            }
        }

        // Clean up HTML entities
        passage = passage
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        question = question
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')
            .trim();

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


        // Create JSON structure
        const jsonData = {
            questionLink: getPracticeUrl(),
            source: 'gmat-hero',
            difficulty: metadata.difficulty || '',
            section: 'verbal',
            questionType: 'cr',
            category: 'CR',
            correctAnswer: metadata.correctAnswer || '',
            content: {
                passage: decodeHtmlEntities(passage),
                questionText: decodeHtmlEntities(question),
                answerChoices: answerChoices.map(choice => decodeHtmlEntities(choice))
            }
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting CR content:', error);
        return null;
    }
}

export default { extractQuestionData };
