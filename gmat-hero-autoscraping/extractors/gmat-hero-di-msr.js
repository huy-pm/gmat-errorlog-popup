/**
 * GMAT Hero Autoscraping - Multi-Source Reasoning (MSR) Extractor
 * Extracts DI questions with tabbed data sources
 */

import {
    decodeHtmlEntities,
    delay,
    getPracticeUrl,
    extractGMATHeroMetadata,
    escapeCurrencyInElement,
    normalizeCurrency,
    processKaTeX
} from '../utils.js';

// MSR state - questions share data sources
let questionSet = null;
let lastTabSignature = null;  // Track tab headers to detect new question sets

/**
 * Reset the question set (call when starting a new extraction session)
 */
export function reset() {
    questionSet = null;
    lastTabSignature = null;
}

/**
 * Get a signature of the current tab headers to detect new question sets
 * @returns {string} Concatenated tab header names
 */
function getTabSignature() {
    const irMsr = document.querySelector('.ir-msr');
    if (!irMsr) return '';

    const tabHeaders = irMsr.querySelectorAll('.p-tabview-nav li a span');
    const names = [];
    tabHeaders.forEach(th => {
        names.push(th.textContent.trim());
    });
    return names.join('|');
}

/**
 * Check if we've moved to a new question set (different data sources)
 * @returns {boolean} True if this is a new question set
 */
function isNewQuestionSet() {
    const currentSignature = getTabSignature();

    // If no previous signature, it's the first set
    if (!lastTabSignature) {
        return true;
    }

    // Compare signatures - different tabs = new question set
    if (currentSignature !== lastTabSignature) {
        console.log('New MSR question set detected - tab signature changed');
        console.log('Previous:', lastTabSignature);
        console.log('Current:', currentSignature);
        return true;
    }

    return false;
}

/**
 * Extract complex table with multi-row headers and section rows
 * @param {HTMLTableElement} table - The table element to extract
 * @returns {Object|null} Table data with headers, headerGroups, and rows
 */
function extractComplexTable(table) {
    const result = {
        title: '',
        headers: [],
        headerGroups: [],
        rows: []
    };

    // Extract table title if present (usually in a centered paragraph before the table)
    const prevSibling = table.previousElementSibling;
    if (prevSibling && prevSibling.querySelector('strong')) {
        result.title = prevSibling.textContent.trim();
    }

    // Extract headers from thead
    const thead = table.querySelector('thead');
    if (thead) {
        const headerRows = thead.querySelectorAll('tr');

        // Process each header row
        headerRows.forEach((tr, rowIndex) => {
            const cells = tr.querySelectorAll('th');
            cells.forEach(th => {
                const text = th.textContent.trim();
                const colspan = parseInt(th.getAttribute('colspan')) || 1;
                const rowspan = parseInt(th.getAttribute('rowspan')) || 1;

                if (rowIndex === 0 && colspan > 1) {
                    // This is a header group (e.g., "Loan Type" spanning multiple columns)
                    result.headerGroups.push({
                        text: text,
                        colspan: colspan
                    });
                } else if (rowspan === 1 || rowIndex > 0) {
                    // This is a regular header in subsequent row or not spanning
                    if (text && rowIndex > 0) {
                        result.headers.push(text);
                    } else if (text && rowIndex === 0 && colspan === 1 && rowspan === 1) {
                        result.headers.push(text);
                    }
                }
            });
        });
    }

    // Extract rows from tbody
    const tbody = table.querySelector('tbody');
    if (tbody) {
        const tableRows = tbody.querySelectorAll('tr');

        tableRows.forEach(tr => {
            const cells = tr.querySelectorAll('td');
            if (cells.length === 0) return;

            const firstCell = cells[0];
            const colspan = parseInt(firstCell.getAttribute('colspan')) || 1;

            // Check if this is a section header row (spans all columns)
            if (cells.length === 1 && colspan >= 2) {
                // This is a section header (e.g., "Seasonality:", "Security:", "Purpose:")
                result.rows.push({
                    type: 'section',
                    text: firstCell.textContent.trim()
                });
            } else {
                // This is a data row
                const rowData = [];
                cells.forEach(td => {
                    rowData.push(td.textContent.trim());
                });

                if (rowData.length > 0) {
                    result.rows.push({
                        type: 'data',
                        cells: rowData
                    });
                }
            }
        });
    }

    // Return null if no meaningful data extracted
    if (result.headers.length === 0 && result.rows.length === 0) {
        return null;
    }

    return result;
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

            // Process KaTeX math expressions
            escapeCurrencyInElement(clonedDiv);
            processKaTeX(clonedDiv);

            // Handle table and its title to avoid duplication in text
            const tableInClone = clonedDiv.querySelector('table.embed-table') || clonedDiv.querySelector('table');
            if (tableInClone) {
                const prevSibling = tableInClone.previousElementSibling;
                // If the previous element is a paragraph with bold text (likely the title)
                if (prevSibling && (prevSibling.querySelector('strong') || prevSibling.tagName === 'STRONG')) {
                    prevSibling.remove();
                }
                tableInClone.remove();
            }

            // Remove any remaining images to get clean text
            const imgsToRemove = clonedDiv.querySelectorAll('img');
            imgsToRemove.forEach(img => img.remove());

            content.text = normalizeCurrency(decodeHtmlEntities(clonedDiv.textContent.trim()));

            // Extract table if present
            const table = textDiv.querySelector('table.embed-table') || textDiv.querySelector('table');
            if (table) {
                const tableData = extractComplexTable(table);
                if (tableData) {
                    content.table = tableData;
                }
            }

            // Extract images
            const images = textDiv.querySelectorAll('img');
            const BASE_URL = 'https://gmat-hero-v2.web.app';
            images.forEach(img => {
                let src = img.getAttribute('src');
                if (src) {
                    // Normalize to full URL if relative path
                    if (!src.startsWith('http')) {
                        // Handle relative paths - use fixed GMAT Hero base URL
                        if (src.startsWith('../') || src.startsWith('./')) {
                            // Resolve relative to /assets/img/question/
                            src = new URL(src, BASE_URL + '/assets/img/question/').href;
                        } else if (src.startsWith('/')) {
                            src = BASE_URL + src;
                        } else {
                            src = BASE_URL + '/' + src;
                        }
                    }
                    content.images.push(src);
                }
            });
        }

        tabs.push({ name: tabName, content });
    }

    // Update the tab signature after successful extraction
    lastTabSignature = getTabSignature();

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

    // Clone and process question stem for KaTeX
    const stemClone = questionStem.cloneNode(true);
    escapeCurrencyInElement(stemClone);
    processKaTeX(stemClone);
    const questionText = normalizeCurrency(decodeHtmlEntities(stemClone.textContent.trim()));

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

            // Process KaTeX in statement text
            const statementClone = statementTextDiv.cloneNode(true);
            escapeCurrencyInElement(statementClone);
            processKaTeX(statementClone);
            const statementText = normalizeCurrency(statementClone.textContent.trim());

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
            // The input is nested: p-radiobutton > div > div.p-hidden-accessible > input
            const radioButton = option.querySelector('p-radiobutton input') ||
                option.querySelector('p-radiobutton div input');
            const label = option.querySelector('label span');

            if (label) {
                const letter = radioButton?.value || '';

                // Process KaTeX in option text
                const labelClone = label.cloneNode(true);
                escapeCurrencyInElement(labelClone);
                processKaTeX(labelClone);
                const text = normalizeCurrency(decodeHtmlEntities(labelClone.textContent.trim()));
                const isCorrect = option.querySelector('p-radiobutton')?.classList.contains('correct-answer') ||
                    option.classList.contains('correct-answer');

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

        // Check if we've moved to a new question set (different data sources)
        const needsNewSet = isNewQuestionSet();

        // If this is a new question set or first question, extract data sources
        if (!questionSet || needsNewSet) {
            // Reset if this is a new set
            if (needsNewSet && questionSet) {
                console.log('Resetting question set for new data sources');
            }

            const dataSources = await extractDataSources();
            if (!dataSources) {
                console.error('Failed to extract data sources');
                return null;
            }

            questionSet = {
                questionSetLink: getPracticeUrl(),
                source: 'gmat-hero',
                section: 'di',
                questionType: 'di',
                category: 'MSR',
                dataSources: dataSources,
                questions: [],
                _tabSignature: lastTabSignature  // Internal field for matching
            };
        }

        // Extract current question
        const question = extractQuestion();
        if (!question) {
            console.error('Failed to extract question');
            return null;
        }

        // Add question ID, difficulty, and link
        question.questionId = questionSet.questions.length + 1;
        question.questionLink = getPracticeUrl();
        question.difficulty = metadata.difficulty || '';

        // Add question to set
        questionSet.questions.push(question);

        return questionSet;

    } catch (error) {
        console.error('Error extracting MSR question:', error);
        return null;
    }
}

export default { extractQuestionData, reset };

