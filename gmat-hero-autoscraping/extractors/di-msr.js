/**
 * GMAT Hero Autoscraping - Multi-Source Reasoning (MSR) Extractor
 * Extracts DI questions with tabbed data sources
 */

import {
    decodeHtmlEntities,
    delay,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../utils.js';

// MSR state - questions share data sources
let questionSet = null;

/**
 * Reset the question set (call when starting a new extraction session)
 */
export function reset() {
    questionSet = null;
}

/**
 * Extract data sources from tabs
 * @returns {Object|null} Data sources object
 */
async function extractDataSources() {
    const irMsr = document.querySelector('.ir-msr');
    if (!irMsr) {
        console.warn('No .ir-msr container found');
        return null;
    }

    const tabs = [];

    // Get all tab headers
    const tabHeaders = irMsr.querySelectorAll('.p-tabview-nav li a span');
    const tabPanels = irMsr.querySelectorAll('.p-tabview-panel');

    if (tabHeaders.length !== tabPanels.length) {
        console.warn('Mismatch between tab headers and panels');
        return null;
    }

    // Extract content from each tab
    for (let i = 0; i < tabHeaders.length; i++) {
        const tabName = tabHeaders[i].textContent.trim();

        // Click tab to activate it
        const tabLink = tabHeaders[i].closest('a');
        if (tabLink) {
            tabLink.click();
            await delay(500);
        }

        const panel = tabPanels[i];
        const content = {
            text: '',
            table: null,
            images: []
        };

        // Extract text content
        const textDiv = panel.querySelector('div[_ngcontent-ng-c2296498254]') || panel.querySelector('div');
        if (textDiv) {
            // Clone the div to manipulate
            const clonedDiv = textDiv.cloneNode(true);

            // Remove table and img elements to get clean text
            const tablesToRemove = clonedDiv.querySelectorAll('table');
            tablesToRemove.forEach(t => t.remove());
            const imgsToRemove = clonedDiv.querySelectorAll('img');
            imgsToRemove.forEach(img => img.remove());

            content.text = decodeHtmlEntities(clonedDiv.textContent.trim());

            // Extract table if present
            const table = textDiv.querySelector('table.embed-table') || textDiv.querySelector('table');
            if (table) {
                const headers = [];
                const rows = [];

                // Extract headers
                const headerCells = table.querySelectorAll('thead th');
                headerCells.forEach(th => {
                    headers.push(th.textContent.trim());
                });

                // Extract rows
                const tableRows = table.querySelectorAll('tbody tr');
                tableRows.forEach(tr => {
                    const rowData = [];
                    const cells = tr.querySelectorAll('td');
                    cells.forEach(td => {
                        rowData.push(td.textContent.trim());
                    });
                    if (rowData.length > 0) {
                        rows.push(rowData);
                    }
                });

                if (headers.length > 0 || rows.length > 0) {
                    content.table = { headers, rows };
                }
            }

            // Extract images
            const images = textDiv.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src) {
                    content.images.push(src);
                }
            });
        }

        tabs.push({ name: tabName, content });
    }

    return { tabs };
}

/**
 * Extract current question
 * @returns {Object|null} Question data
 */
function extractQuestion() {
    // Extract question text
    const questionStem = document.querySelector('#right-panel .question-stem');
    if (!questionStem) {
        console.warn('No question stem found');
        return null;
    }
    const questionText = decodeHtmlEntities(questionStem.textContent.trim());

    // Detect question type
    const yesNoQuestion = document.querySelector('.yes-no-question');
    const standardChoices = document.querySelector('.standard-choices');

    const question = { questionText };

    if (yesNoQuestion) {
        // Binary choice question
        question.questionType = 'binary';

        const gridItems = Array.from(yesNoQuestion.querySelectorAll('.grid-item'));

        // Extract choice labels
        const choice1Label = gridItems[0]?.querySelector('b')?.textContent.trim() || 'Yes';
        const choice2Label = gridItems[1]?.querySelector('b')?.textContent.trim() || 'No';

        question.choiceLabels = [choice1Label, choice2Label];
        question.statements = [];

        // Extract statements (skip first 3 grid items: headers)
        for (let i = 3; i < gridItems.length; i += 3) {
            const radioChoice1Div = gridItems[i];
            const radioChoice2Div = gridItems[i + 1];
            const statementTextDiv = gridItems[i + 2];

            if (!statementTextDiv) break;

            const statementText = statementTextDiv.textContent.trim();

            // Find correct answer
            let correctAnswer = null;
            const radioChoice1 = radioChoice1Div.querySelector('p-radiobutton');
            const radioChoice2 = radioChoice2Div.querySelector('p-radiobutton');

            if (radioChoice1?.classList.contains('correct-answer')) {
                correctAnswer = choice1Label;
            } else if (radioChoice2?.classList.contains('correct-answer')) {
                correctAnswer = choice2Label;
            }

            question.statements.push({ text: statementText, correctAnswer });
        }
    } else if (standardChoices) {
        // Multiple choice question
        question.questionType = 'multipleChoice';
        question.options = [];
        question.correctAnswer = null;

        const options = standardChoices.querySelectorAll('.option');
        options.forEach(option => {
            const radioButton = option.querySelector('p-radiobutton input');
            const label = option.querySelector('label span');

            if (radioButton && label) {
                const letter = radioButton.value;
                const text = decodeHtmlEntities(label.textContent.trim());
                const isCorrect = option.querySelector('p-radiobutton')?.classList.contains('correct-answer');

                question.options.push({ letter, text, isCorrect });

                if (isCorrect) {
                    question.correctAnswer = letter;
                }
            }
        });
    }

    return question;
}

/**
 * Extract MSR question data
 * @returns {Object|null} Question set data or null if extraction fails
 */
export async function extractQuestionData() {
    try {
        // Extract metadata
        const metadata = extractGMATHeroMetadata();

        // If this is the first question, extract data sources
        if (!questionSet) {
            const dataSources = await extractDataSources();
            if (!dataSources) {
                console.error('Failed to extract data sources');
                return null;
            }

            questionSet = {
                questionSetLink: getPracticeUrl(),
                source: 'GMAT HERO',
                difficulty: metadata.difficulty || '',
                section: 'di',
                questionType: 'di',
                category: 'MSR',
                dataSources: dataSources,
                questions: []
            };
        }

        // Extract current question
        const question = extractQuestion();
        if (!question) {
            console.error('Failed to extract question');
            return null;
        }

        // Add question ID
        question.questionId = questionSet.questions.length + 1;

        // Add question to set
        questionSet.questions.push(question);

        return questionSet;

    } catch (error) {
        console.error('Error extracting MSR question:', error);
        return null;
    }
}

export default { extractQuestionData, reset };
