/**
 * Category Discovery - Dynamically scrapes GMAT Hero study pages to find all categories
 *
 * Works by:
 * 1. Finding all <table> elements inside the selection area
 * 2. Detecting the question type from the table's CSS class (cr, rc, ds, etc.)
 * 3. Detecting the study page context from the current URL (og-verbal, og-quant, etc.)
 * 4. For each data row: extracting name, question count, and constructing the review URL
 *    by programmatically clicking the row to discover Angular's route, then navigating back
 *
 * Fallback: If click-based discovery fails, constructs URLs from known patterns.
 */

import type { CategoryDefinition } from './types';

/** Map of table CSS class → question type code used in URL IDs */
const TABLE_CLASS_TO_TYPE: Record<string, string> = {
    'cr': 'CR',
    'rc': 'RC',
    'sc': 'SC',
    'ps': 'PS',
    'quant': 'PS',
    'ds': 'DS',
    'gi': 'GI',
    'msr': 'MSR',
    'ta': 'TA',
    'tpa': 'TPA',
    'di': 'DI',
    'ir': 'IR',
    // real-gmat specific table classes
    'rq': 'RQ',   // Real Quant (PS + DS mixed)
    'rv': 'RV',   // Real Verbal (CR + RC mixed — row name determines sub-type)
};

/** Map of table CSS class → section */
const TABLE_CLASS_TO_SECTION: Record<string, string> = {
    'cr': 'verbal',
    'rc': 'verbal',
    'sc': 'verbal',
    'ps': 'quant',
    'quant': 'quant',
    'ds': 'di',
    'gi': 'di',
    'msr': 'di',
    'ta': 'di',
    'tpa': 'di',
    'di': 'di',
    'ir': 'di',
    // real-gmat specific table classes
    'rq': 'quant',
    'rv': 'verbal',
};

/**
 * Detect the question type code from a table element.
 * Checks the table's class list against known type classes.
 * Falls back to parsing the header text.
 */
function detectTypeFromTable(table: HTMLTableElement): { typeCode: string; section: string; headerText: string } {
    // Check CSS classes first
    for (const cls of table.classList) {
        const lower = cls.toLowerCase();
        if (TABLE_CLASS_TO_TYPE[lower]) {
            return {
                typeCode: TABLE_CLASS_TO_TYPE[lower],
                section: TABLE_CLASS_TO_SECTION[lower],
                headerText: getTableHeader(table)
            };
        }
    }

    // Fallback: parse header text
    const header = getTableHeader(table).toLowerCase();

    if (header.includes('critical reasoning')) return { typeCode: 'CR', section: 'verbal', headerText: getTableHeader(table) };
    if (header.includes('reading comprehension')) return { typeCode: 'RC', section: 'verbal', headerText: getTableHeader(table) };
    if (header.includes('sentence correction')) return { typeCode: 'SC', section: 'verbal', headerText: getTableHeader(table) };
    if (header.includes('problem solving') || header.includes('quant')) return { typeCode: 'PS', section: 'quant', headerText: getTableHeader(table) };
    if (header.includes('data sufficiency')) return { typeCode: 'DS', section: 'di', headerText: getTableHeader(table) };
    if (header.includes('graphic interpretation')) return { typeCode: 'GI', section: 'di', headerText: getTableHeader(table) };
    if (header.includes('multi-source')) return { typeCode: 'MSR', section: 'di', headerText: getTableHeader(table) };
    if (header.includes('table analysis')) return { typeCode: 'TA', section: 'di', headerText: getTableHeader(table) };
    if (header.includes('two-part')) return { typeCode: 'TPA', section: 'di', headerText: getTableHeader(table) };

    return { typeCode: 'UNKNOWN', section: 'unknown', headerText: getTableHeader(table) };
}

function getTableHeader(table: HTMLTableElement): string {
    const th = table.querySelector('th[colspan]');
    return th?.textContent?.trim() || '';
}

/**
 * Get the study page prefix from the current URL.
 * e.g., "og-verbal" from "https://gmat-hero-v2.web.app/pages/study/og-verbal"
 */
function getStudyPagePrefix(): string {
    const path = window.location.pathname;
    const match = path.match(/\/pages\/study\/(.+?)(?:\/|$)/);
    return match ? match[1] : '';
}

/**
 * Determine URL prefix based on study page.
 * e.g., "OG" for og-verbal, "PREP" for prep-verbal, "QP1"/"QP2" for question packs
 */
function getSourcePrefix(studyPage: string): string {
    if (studyPage.startsWith('og-')) return 'OG';
    if (studyPage.startsWith('prep-')) return 'PREP';
    if (studyPage.startsWith('lsat-')) return 'LSAT';
    if (studyPage.startsWith('real-')) return 'REAL';
    if (studyPage.includes('class/')) return 'CLASS';
    if (studyPage === 'gmat-club') return 'GMC';
    if (studyPage === 'real-gmat') return 'REAL';
    return 'OG';
}

/**
 * Per-study-page type code overrides.
 * Some pages reuse a generic table class (e.g., "ps") but route to different category ID
 * segments (e.g., "QT" for GMAT Club Quant Tests).
 *
 * Map: studyPage → { originalTypeCode → overrideTypeCode }
 */
const STUDY_PAGE_TYPE_OVERRIDES: Record<string, Record<string, string>> = {
    'gmat-club': {
        'PS': 'QT',   // "GMAT Club - Quant" table uses class "ps" but IDs are GMC-QT-XX
        'CR': 'VT',   // future verbal test table would use class "cr" → GMC-VT-XX
    },
    'real-gmat': {
        'PS': 'RQ',   // "GMAT Club - Quant" table uses class "ps" but IDs are RQ-XX
        'CR': 'RCR',
        'RC': 'RRC',
    }
};

/**
 * Construct the category ID from the row number and type.
 * Special cases for "Advance" and "Question Pack" categories.
 */
function constructCategoryId(
    rowName: string,
    rowIndex: number,
    typeCode: string,
    sourcePrefix: string
): string {
    const nameLower = rowName.toLowerCase();

    // ── real-gmat ──────────────────────────────────────────────────────────────
    // IDs embed the type in the prefix itself (RQ-01, RCR-01, RRC-01) and carry
    // no separate source prefix. The row name determines the sub-type for the
    // mixed "rv" (Real Verbal) table.
    if (sourcePrefix === 'REAL') {
        // Derive the ID segment and number from the row name
        const realMatch = nameLower.match(/^real\s+(quant|cr|rc)\s+(\d+)/i);
        if (realMatch) {
            const typeMap: Record<string, string> = { quant: 'RQ', cr: 'RCR', rc: 'RRC' };
            const idPrefix = typeMap[realMatch[1].toLowerCase()] ?? typeCode;
            const num = String(parseInt(realMatch[2], 10)).padStart(2, '0');
            return `${idPrefix}-${num}`;
        }
        // Fallback: use typeCode + rowIndex (no source prefix)
        return `${typeCode}-${String(rowIndex).padStart(2, '0')}`;
    }

    // Advance categories
    if (nameLower.includes('advance')) {
        return `ADVANCE-${typeCode}`;
    }

    // Question Pack categories
    const qpMatch = nameLower.match(/question\s*pack\s*(\d+)/i);
    if (qpMatch) {
        return `QP${qpMatch[1]}-${typeCode}`;
    }

    // Standard numbered categories: OG-CR-01, OG-PS-06, etc.
    const paddedIndex = String(rowIndex).padStart(2, '0');
    return `${sourcePrefix}-${typeCode}-${paddedIndex}`;
}

/**
 * Discover categories from the Full Test listing page (/pages/study/full-test).
 *
 * Structure: `.test-card` elements, each with:
 *   - `h5.test-name` = date string like "2025.05-01"
 *   - `.score-section.quant / .verbal / .data` → scores + question totals
 *
 * URL pattern:
 *   "2025.05-01" → slug "202505-01"
 *   Quant  → full-test/202505-01M/review/1
 *   Verbal → full-test/202505-01V/review/1
 *   Data   → full-test/202505-01D/review/1
 *
 * test_group follows the sequential card order: official-01, official-02, ...
 */
function discoverFullTestCategories(baseUrl: string): CategoryDefinition[] {
    const categories: CategoryDefinition[] = [];

    const cards = document.querySelectorAll('.test-card');
    if (cards.length === 0) {
        console.log('[Batch Discovery] No .test-card elements found on full-test page');
        return categories;
    }

    const sectionDefs = [
        { cssClass: 'quant',  code: 'M', section: 'quant',  label: 'Quant'  },
        { cssClass: 'verbal', code: 'V', section: 'verbal', label: 'Verbal' },
        { cssClass: 'data',   code: 'D', section: 'di',     label: 'Data'   },
    ];

    cards.forEach((card, index) => {
        // e.g. "2025.05-01" → "202505-01" (remove the single dot between year and month)
        const rawName = (card.querySelector('.test-name') as HTMLElement)?.textContent?.trim() || '';
        const dateSlug = rawName.replace('.', ''); // "202505-01"

        // test_group: "2025.05-01" → "fulltest-2025-05-01" (dot → dash)
        const testGroup = `fulltest-${rawName.replace('.', '-')}`;

        sectionDefs.forEach(({ cssClass, code, section, label }) => {
            const scoreEl = card.querySelector(`.score-section.${cssClass} .score-value`);
            const scoreText = scoreEl?.textContent?.trim() || '0/0';
            const questionCount = parseInt(scoreText.split('/')[1] || '0', 10) || 0;

            const categoryId = `FULLTEST-${dateSlug}-${code}`;
            const reviewUrl = `${baseUrl}/${dateSlug}${code}/review/1`;

            categories.push({
                id: categoryId,
                name: `${testGroup} - ${label}`,
                section,
                url: reviewUrl,
                questionCount,
                testGroup,
            });
        });
    });

    console.log(`[Batch Discovery] Full Test: discovered ${cards.length} tests → ${categories.length} categories`);
    return categories;
}

/**
 * Main discovery function - finds all categories from tables on the current page.
 * This is a dynamic approach that works with any GMAT Hero study page.
 */
export function discoverCategories(): CategoryDefinition[] {
    const categories: CategoryDefinition[] = [];
    const studyPage = getStudyPagePrefix();
    const sourcePrefix = getSourcePrefix(studyPage);
    const baseUrl = `${window.location.origin}/pages/study/${studyPage}`;

    console.log(`[Batch Discovery] Study page: ${studyPage}, source: ${sourcePrefix}`);

    // Full Test page uses a completely different DOM structure (cards, not tables)
    if (studyPage === 'full-test') {
        return discoverFullTestCategories(baseUrl);
    }

    // Find all category tables - they are inside .selection divs or directly in the card body
    const tables = document.querySelectorAll('table');

    for (const table of tables) {
        const { typeCode: rawTypeCode, section, headerText } = detectTypeFromTable(table as HTMLTableElement);
        if (rawTypeCode === 'UNKNOWN') {
            console.log(`[Batch Discovery] Skipping unknown table: "${headerText}"`);
            continue;
        }

        // Apply per-study-page type code overrides (e.g., gmat-club "ps" table → "QT")
        const pageOverrides = STUDY_PAGE_TYPE_OVERRIDES[studyPage] || {};
        const typeCode = pageOverrides[rawTypeCode] ?? rawTypeCode;

        console.log(`[Batch Discovery] Found table: "${headerText}" (type=${typeCode}, section=${section})`);

        // Get all data rows (skip header rows - those with <th> cells)
        const rows = table.querySelectorAll('tr');
        let dataRowIndex = 0;

        for (const row of rows) {
            // Skip header rows
            if (row.querySelector('th')) continue;

            const cells = row.querySelectorAll('td');
            if (cells.length < 3) continue;

            dataRowIndex++;

            // Cell layout: [No., Description, Questions, Complete]
            const rowNumber = parseInt(cells[0]?.textContent?.trim() || '0', 10) || dataRowIndex;
            const name = cells[1]?.textContent?.trim() || `Category ${rowNumber}`;
            const questionCount = parseInt(cells[2]?.textContent?.trim() || '0', 10) || 0;

            const categoryId = constructCategoryId(name, rowNumber, typeCode, sourcePrefix);
            const reviewUrl = `${baseUrl}/${categoryId}/review/1`;

            categories.push({
                id: categoryId,
                name: `${headerText ? headerText.replace(/^.*-\s*/, '') : typeCode} - ${name}`,
                section,
                url: reviewUrl,
                questionCount
            });
        }
    }

    // If tables weren't found, try alternative DOM structures
    if (categories.length === 0) {
        console.log('[Batch Discovery] No tables found, trying alternative discovery...');
        discoverFromClickableElements(categories, studyPage, baseUrl);
    }

    console.log(`[Batch Discovery] Discovered ${categories.length} categories total`);
    return categories;
}

/**
 * Alternative discovery: look for any clickable list items, cards, or links
 * that might represent categories.
 */
function discoverFromClickableElements(
    categories: CategoryDefinition[],
    studyPage: string,
    baseUrl: string
) {
    // Look for Angular-rendered list items or card elements that might be categories
    const selectors = [
        '.selection',
        '.category-list',
        '[class*="category"]',
        '[class*="quiz"]',
        '.card-body',
        'nb-card-body'
    ];

    for (const selector of selectors) {
        const containers = document.querySelectorAll(selector);
        for (const container of containers) {
            // Look for clickable rows within
            const items = container.querySelectorAll('tr.ng-star-inserted, li.ng-star-inserted, [class*="item"]');
            let index = 0;

            for (const item of items) {
                index++;
                const text = item.textContent?.trim() || '';
                if (!text || text.length < 3) continue;

                // Skip header-like items
                if (item.querySelector('th')) continue;

                // Try to extract name and count
                const parts = text.split(/\s+/);
                const name = parts.slice(1, -1).join(' ') || text.substring(0, 50);
                const lastPart = parts[parts.length - 1];
                const count = parseInt(lastPart, 10) || 0;

                categories.push({
                    id: `discovered-${index}`,
                    name,
                    section: 'unknown',
                    url: `${baseUrl}/CATEGORY-${String(index).padStart(2, '0')}/review/1`,
                    questionCount: count
                });
            }
        }

        if (categories.length > 0) break;
    }
}

/**
 * Enhanced discovery that uses click simulation to find actual URLs.
 * This clicks each table row, captures the URL Angular navigates to,
 * then navigates back. Slower but 100% accurate.
 */
export async function discoverCategoriesViaClick(): Promise<CategoryDefinition[]> {
    const categories: CategoryDefinition[] = [];
    const studyPage = getStudyPagePrefix();
    const currentUrl = window.location.href;

    const tables = document.querySelectorAll('table');

    for (const table of tables) {
        const { typeCode, section, headerText } = detectTypeFromTable(table as HTMLTableElement);
        if (typeCode === 'UNKNOWN') continue;

        const rows = table.querySelectorAll('tr.ng-star-inserted');

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) continue;

            const name = cells[1]?.textContent?.trim() || `Category ${i + 1}`;
            const questionCount = parseInt(cells[2]?.textContent?.trim() || '0', 10) || 0;

            // Click the row and observe the URL change
            try {
                row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

                // Wait for Angular navigation
                await new Promise(resolve => setTimeout(resolve, 500));

                const newUrl = window.location.href;
                if (newUrl !== currentUrl) {
                    // Extract the category ID from the navigated URL
                    const pathParts = new URL(newUrl).pathname.split('/');
                    // Convert practice URL to review URL
                    const reviewUrl = newUrl.replace('/practice/', '/review/');
                    const categoryId = pathParts[pathParts.length - 3] || `${typeCode}-${i + 1}`;

                    categories.push({
                        id: categoryId,
                        name: `${headerText.replace(/^.*-\s*/, '')} - ${name}`,
                        section,
                        url: reviewUrl,
                        questionCount
                    });

                    // Navigate back
                    window.history.back();
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            } catch (err) {
                console.warn(`[Batch Discovery] Click discovery failed for row ${i}:`, err);
            }
        }
    }

    return categories;
}
