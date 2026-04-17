#!/usr/bin/env node
/**
 * fix-missing-questiontext.js
 *
 * Post-processing script: fixes CR questions where questionText is empty because
 * the question stem ended without a "?" and wasn't caught by COMPLETION_PATTERNS.
 *
 * Fix: extracts the last sentence of content.passage → moves it to content.questionText.
 *
 * Usage:
 *   node fix-missing-questiontext.js [path/to/error-report.json]
 *
 * If no argument is given, automatically finds the most recent error-report-*.json
 * in ~/Downloads/GMAT-HERO/.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'GMAT-HERO');
const VERBAL_DIR = path.join(DOWNLOAD_DIR, 'verbal');

// ─── 1. Resolve error report path ─────────────────────────────────────────────

function findLatestErrorReport() {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        console.error(`Error: Download directory not found: ${DOWNLOAD_DIR}`);
        process.exit(1);
    }
    const files = fs.readdirSync(DOWNLOAD_DIR)
        .filter(f => f.startsWith('error-report-') && f.endsWith('.json'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
        console.error('Error: No error-report-*.json files found in', DOWNLOAD_DIR);
        process.exit(1);
    }
    return path.join(DOWNLOAD_DIR, files[0].name);
}

const errorReportPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : findLatestErrorReport();

console.log(`Using error report: ${errorReportPath}\n`);

// ─── 2. Load and filter errors ────────────────────────────────────────────────

const report = JSON.parse(fs.readFileSync(errorReportPath, 'utf8'));
const crErrors = (report.errors || []).filter(
    e => e.field === 'content.questionText' && e.severity === 'error'
);

if (crErrors.length === 0) {
    console.log('No "Missing questionText" errors found. Nothing to fix.');
    process.exit(0);
}

console.log(`Found ${crErrors.length} missing questionText error(s) to fix.\n`);

// Group by categoryId for efficient file lookup
const errorsByCategoryId = {};
for (const err of crErrors) {
    if (!errorsByCategoryId[err.categoryId]) errorsByCategoryId[err.categoryId] = [];
    errorsByCategoryId[err.categoryId].push(err);
}

// ─── 3. Build categoryId → file path map ─────────────────────────────────────

function buildFileMap() {
    const map = {}; // categoryId → absolute file path
    if (!fs.existsSync(VERBAL_DIR)) {
        console.error(`Error: Verbal directory not found: ${VERBAL_DIR}`);
        process.exit(1);
    }
    const jsonFiles = fs.readdirSync(VERBAL_DIR)
        .filter(f => f.endsWith('.json') && !f.startsWith('error-report'));

    for (const fname of jsonFiles) {
        const fpath = path.join(VERBAL_DIR, fname);
        try {
            const data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
            if (data.categoryId) {
                map[data.categoryId] = fpath;
            }
        } catch {
            // skip unreadable files
        }
    }
    return map;
}

const fileMap = buildFileMap();

// ─── 4. Extract last sentence from passage ────────────────────────────────────

/**
 * Splits passage text into [remainingPassage, lastSentence].
 *
 * Strategy:
 *   - Split on ". " followed by an uppercase letter (sentence boundary)
 *   - Also split on newline characters
 *   - The last non-empty segment becomes questionText
 *   - Remaining segments are re-joined as the passage
 */
function extractLastSentence(passage) {
    if (!passage || !passage.trim()) return [passage, ''];

    // Split on sentence boundaries: ". " before uppercase, or newlines
    const segments = passage
        .split(/(?<=\.)\s+(?=[A-Z])|(?<=\n)\s*(?=[A-Z])|\n+/)
        .map(s => s.trim())
        .filter(Boolean);

    if (segments.length <= 1) {
        // Can't split — return as-is with empty questionText
        return [passage.trim(), ''];
    }

    const lastSentence = segments.pop().trim();
    const remainingPassage = segments.join(' ').trimEnd();

    // Safety: don't move a sentence that ends with "." — that's a full sentence,
    // not a completion stem. The completion stem typically ends without punctuation.
    if (lastSentence.endsWith('.') || lastSentence.endsWith('?') || lastSentence.endsWith('!')) {
        // Unexpected case: last sentence is a complete sentence. Still move it
        // since we know questionText is empty and something must be the question.
        console.warn(`  ⚠ Last sentence ends with punctuation: "${lastSentence.slice(-40)}"`);
    }

    return [remainingPassage, lastSentence];
}

// ─── 5. Apply fixes ──────────────────────────────────────────────────────────

let totalFixed = 0;
let totalFilesModified = 0;

for (const [categoryId, errors] of Object.entries(errorsByCategoryId)) {
    const filePath = fileMap[categoryId];
    if (!filePath) {
        console.warn(`⚠ No data file found for categoryId "${categoryId}" — skipping ${errors.length} error(s)`);
        continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fixedInFile = 0;

    for (const err of errors) {
        const question = data.questions.find(q => q.questionLink === err.questionLink);
        if (!question) {
            console.warn(`  ⚠ Question not found by link: ${err.questionLink}`);
            continue;
        }

        const passage = question.content?.passage || '';
        if (!passage) {
            console.warn(`  ⚠ Passage is also empty for: ${err.questionLink}`);
            continue;
        }

        const [newPassage, questionText] = extractLastSentence(passage);

        if (!questionText) {
            console.warn(`  ⚠ Could not extract last sentence for: ${err.questionLink}`);
            continue;
        }

        question.content.passage = newPassage;
        question.content.questionText = questionText;
        fixedInFile++;
        totalFixed++;

        console.log(`  ✓ [${categoryId}] Q${err.questionIndex + 1}`);
        console.log(`      questionText: "${questionText.slice(0, 80)}${questionText.length > 80 ? '…' : ''}"`);
    }

    if (fixedInFile > 0) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`  → Saved: ${path.basename(filePath)} (${fixedInFile} fix(es))\n`);
        totalFilesModified++;
    }
}

// ─── 6. Summary ──────────────────────────────────────────────────────────────

console.log('─'.repeat(50));
console.log(`Done. Fixed ${totalFixed} question(s) across ${totalFilesModified} file(s).`);
