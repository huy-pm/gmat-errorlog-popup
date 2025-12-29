/**
 * GMAT Hero Autoscraping - Data Sufficiency (DS) Extractor
 * Extracts DS questions with question text and two statements
 */

import {
    decodeHtmlEntities,
    escapeCurrencyInElement,
    normalizeCurrency,
    processKaTeX,
    extractTable,
    getPracticeUrl,
    extractGMATHeroMetadata
} from '../gmat-hero-utils.js';

/**
 * Extract Data Sufficiency question data
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

        // Extract image FIRST (before any processing that might modify the DOM)
        let questionImage = null;
        const imgElement = questionStem.querySelector('img');
        if (imgElement) {
            questionImage = imgElement.src;
        }

        // Clone and process question stem
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = questionStem.innerHTML;

        // Remove image from processing (we already extracted it)
        const tempImages = tempDiv.querySelectorAll('img');
        tempImages.forEach(img => img.remove());

        // Mark statement boundaries BEFORE KaTeX processing
        // This preserves the structure before math elements are converted
        let html = tempDiv.innerHTML;

        // Replace <br><br>(1) with marker
        html = html.replace(/<br\s*\/?>\s*<br\s*\/?>\s*\(1\)/gi, '|||STMT1|||(1)');
        html = html.replace(/<br\s*\/?>\s*\(1\)/gi, '|||STMT1|||(1)');

        // Replace <br><br>(2) with marker  
        html = html.replace(/<br\s*\/?>\s*<br\s*\/?>\s*\(2\)/gi, '|||STMT2|||(2)');
        html = html.replace(/<br\s*\/?>\s*\(2\)/gi, '|||STMT2|||(2)');

        tempDiv.innerHTML = html;

        // Extract table data BEFORE other processing (also removes table from DOM)
        const tableData = extractTable(tempDiv);

        // IMPORTANT: Escape currency symbols BEFORE processing KaTeX
        escapeCurrencyInElement(tempDiv);

        // Process KaTeX math expressions
        processKaTeX(tempDiv);

        // Replace remaining <br> tags with spaces
        let processedHtml = tempDiv.innerHTML;
        processedHtml = processedHtml.replace(/<br\s*\/?>/gi, ' ');
        tempDiv.innerHTML = processedHtml;

        // Get the full text content
        let fullText = tempDiv.textContent || '';

        // Clean up whitespace
        fullText = fullText.replace(/\s+/g, ' ').trim();

        // Split by markers
        let questionText = '';
        let statement1 = '';
        let statement2 = '';

        if (fullText.includes('|||STMT1|||') && fullText.includes('|||STMT2|||')) {
            const parts = fullText.split('|||STMT1|||');
            questionText = parts[0].trim();

            const remainingParts = parts[1].split('|||STMT2|||');
            statement1 = remainingParts[0].trim();
            statement2 = remainingParts[1].trim();
        } else {
            // Fallback: try to find (1) and (2) directly in text
            const stmt1Match = fullText.match(/\(1\)\s*/);
            const stmt2Match = fullText.match(/\(2\)\s*/);

            if (stmt1Match && stmt2Match) {
                const stmt1Index = fullText.indexOf('(1)');
                const stmt2Index = fullText.indexOf('(2)');

                if (stmt1Index > 0 && stmt2Index > stmt1Index) {
                    questionText = fullText.substring(0, stmt1Index).trim();
                    statement1 = fullText.substring(stmt1Index, stmt2Index).trim();
                    statement2 = fullText.substring(stmt2Index).trim();
                }
            }
        }

        // If we couldn't parse properly, return null
        if (!questionText || !statement1 || !statement2) {
            console.warn('Could not parse DS question structure');
            console.log('Full text was:', fullText);
            return null;
        }

        // Extract metadata
        const metadata = extractGMATHeroMetadata();

        // Create JSON structure
        const jsonData = {
            questionLink: getPracticeUrl(),
            source: 'gmat-hero',
            difficulty: metadata.difficulty || '',
            section: 'di',
            questionType: 'di',
            category: 'DS',
            correctAnswer: metadata.correctAnswer || '',
            content: {
                questionText: normalizeCurrency(decodeHtmlEntities(questionText)),
                statements: [
                    normalizeCurrency(decodeHtmlEntities(statement1)),
                    normalizeCurrency(decodeHtmlEntities(statement2))
                ],
                image: questionImage,
                table: tableData
            }
        };

        return jsonData;

    } catch (error) {
        console.error('Error extracting DS content:', error);
        return null;
    }
}

export default { extractQuestionData };
