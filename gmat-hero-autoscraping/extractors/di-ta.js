/**
 * GMAT Hero Autoscraping - Table Analysis (TA) Extractor
 * Extracts DI questions with sortable tables and binary statements
 */

import {
    decodeHtmlEntities,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../utils.js';

/**
 * Extract Table Analysis question data
 * @returns {Object|null} Question data or null if extraction fails
 */
export async function extractQuestionData() {
    try {
        // 1. Find .ir-ta container
        const irTa = document.querySelector('.ir-ta');
        if (!irTa) {
            console.warn('No .ir-ta container found');
            return null;
        }

        // 2. Extract Intro Text
        const introTextDiv = irTa.querySelector('div.ng-star-inserted');
        const introText = introTextDiv ? introTextDiv.textContent.trim() : '';

        // 3. Extract Table Headers
        const thead = irTa.querySelector('thead');
        if (!thead) {
            console.warn('No thead found');
            return null;
        }

        let headerGroups = null;
        const headers = [];

        // Check if there's a sub-header row (merged headers)
        const subHeaderRow = thead.querySelector('tr.sub-header');
        if (subHeaderRow) {
            headerGroups = [];
            const groupHeaders = subHeaderRow.querySelectorAll('th');
            groupHeaders.forEach(th => {
                const colspan = th.getAttribute('colspan') || '1';
                headerGroups.push({
                    label: th.textContent.trim(),
                    colspan: parseInt(colspan, 10)
                });
            });
        }

        // Extract regular headers (column names)
        const headerRows = thead.querySelectorAll('tr');
        const lastHeaderRow = headerRows[headerRows.length - 1];
        const headerCells = lastHeaderRow.querySelectorAll('th > div');
        headerCells.forEach(cell => {
            headers.push(cell.textContent.trim());
        });

        // 4. Extract Table Rows
        const tbody = irTa.querySelector('tbody');
        if (!tbody) {
            console.warn('No tbody found');
            return null;
        }

        const rows = [];
        const tableRows = tbody.querySelectorAll('tr');
        tableRows.forEach(tr => {
            const rowData = [];
            const cells = tr.querySelectorAll('td > span');
            cells.forEach(span => {
                rowData.push(span.textContent.trim());
            });
            if (rowData.length > 0) {
                rows.push(rowData);
            }
        });

        // 5. Extract Table Legend/Footnotes (if present)
        let tableLegend = null;
        const legendDiv = irTa.querySelector('.sortable-table + div.ng-star-inserted');
        if (legendDiv) {
            const legendText = legendDiv.textContent.trim();
            if (legendText) {
                tableLegend = decodeHtmlEntities(legendText);
            }
        }

        // 6. Extract Question Instruction
        const questionStem = document.querySelector('#right-panel .question-stem');
        if (!questionStem) {
            console.warn('No question stem found');
            return null;
        }
        const questionInstruction = questionStem.textContent.trim();

        // 7. Extract Binary Choice Statements (Yes/No, True/False, etc.)
        const yesNoQuestion = document.querySelector('.yes-no-question');
        if (!yesNoQuestion) {
            console.warn('No yes-no-question container found');
            return null;
        }

        const gridItems = Array.from(yesNoQuestion.querySelectorAll('.grid-item'));

        // Extract the actual choice labels from headers (index 0 and 1)
        const choice1Label = gridItems[0]?.querySelector('b')?.textContent.trim() || 'Y';
        const choice2Label = gridItems[1]?.querySelector('b')?.textContent.trim() || 'N';

        const statements = [];

        // Pattern: Choice1 header (0), Choice2 header (1), empty (2),
        // then repeating: radio-choice1 (3), radio-choice2 (4), statement-text (5)
        for (let i = 3; i < gridItems.length; i += 3) {
            const radioChoice1Div = gridItems[i];
            const radioChoice2Div = gridItems[i + 1];
            const statementTextDiv = gridItems[i + 2];

            if (!statementTextDiv) break;

            const statementText = statementTextDiv.textContent.trim();

            // Find correct answer by checking which radio button has 'correct-answer' class
            let correctAnswer = null;
            const radioChoice1 = radioChoice1Div.querySelector('p-radiobutton');
            const radioChoice2 = radioChoice2Div.querySelector('p-radiobutton');

            if (radioChoice1?.classList.contains('correct-answer')) {
                correctAnswer = choice1Label;
            } else if (radioChoice2?.classList.contains('correct-answer')) {
                correctAnswer = choice2Label;
            }

            statements.push({ text: statementText, correctAnswer });
        }

        // 8. Metadata
        const metadata = extractGMATHeroMetadata();

        // Construct table data
        const tableData = { headers, rows };

        // Add headerGroups if they exist (merged headers)
        if (headerGroups) {
            tableData.headerGroups = headerGroups;
        }

        // Add tableLegend if it exists
        if (tableLegend) {
            tableData.legend = tableLegend;
        }

        // Construct Final JSON
        const jsonData = {
            questionLink: getPracticeUrl(),
            source: 'GMAT HERO',
            difficulty: metadata.difficulty || '',
            section: 'di',
            questionType: 'di',
            category: 'TA',
            content: {
                introText: decodeHtmlEntities(introText),
                table: tableData,
                questionInstruction: decodeHtmlEntities(questionInstruction),
                choiceLabels: [choice1Label, choice2Label],
                statements: statements
            }
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting TA Content:', error);
        return null;
    }
}

export default { extractQuestionData };
