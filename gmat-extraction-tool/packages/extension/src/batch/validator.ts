/**
 * Batch Autoscraping - Validation Layer
 *
 * Validates extracted question data for completeness and consistency.
 * Generates error/warning reports for manual review.
 */

import type { ExtractedQuestion, BatchError, ValidationReport } from './types';

interface ValidationRule {
    field: string;
    check: (question: ExtractedQuestion) => boolean;
    severity: 'error' | 'warning';
    message: string;
    /** Question types this rule applies to. If empty, applies to all. */
    appliesTo?: string[];
}

// Rules that apply to ALL question types
const UNIVERSAL_RULES: ValidationRule[] = [
    {
        field: 'questionLink',
        check: (q) => !!q.questionLink && q.questionLink.startsWith('http'),
        severity: 'error',
        message: 'Missing or invalid questionLink'
    },
    {
        field: 'source',
        check: (q) => !!q.source,
        severity: 'error',
        message: 'Missing source'
    },
    {
        field: 'section',
        check: (q) => ['quant', 'verbal', 'di'].includes(q.section),
        severity: 'error',
        message: 'Invalid section (must be quant, verbal, or di)'
    },
    {
        field: 'questionType',
        check: (q) => !!q.questionType,
        severity: 'error',
        message: 'Missing questionType'
    },
    {
        field: 'difficulty',
        check: (q) => ['easy', 'medium', 'hard'].includes(q.difficulty),
        severity: 'warning',
        message: 'Missing or invalid difficulty'
    },
    {
        field: 'category',
        check: (q) => !!q.category && q.category.length > 0,
        severity: 'warning',
        message: 'Missing category'
    }
];

// Section-questionType consistency
const CONSISTENCY_RULES: ValidationRule[] = [
    {
        field: 'section-questionType',
        check: (q) => {
            if (q.questionType === 'cr' || q.questionType === 'rc') return q.section === 'verbal';
            if (q.questionType === 'quant') return q.section === 'quant';
            if (q.questionType === 'di' || q.questionType?.startsWith('di-') || q.questionType === 'ds') return q.section === 'di';
            return true;
        },
        severity: 'error',
        message: 'Section does not match questionType'
    }
];

// Type-specific content rules
const CONTENT_RULES: ValidationRule[] = [
    // Quant
    {
        field: 'content.questionText',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            return !!c?.questionText && (c.questionText as string).length > 0;
        },
        severity: 'error',
        message: 'Missing questionText',
        appliesTo: ['quant', 'cr', 'ds']
    },
    {
        field: 'content.answerChoices',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            return Array.isArray(c?.answerChoices) && (c.answerChoices as unknown[]).length === 5;
        },
        severity: 'error',
        message: 'answerChoices should have exactly 5 items',
        appliesTo: ['quant', 'cr', 'rc']
    },
    {
        field: 'correctAnswer',
        check: (q) => !!q.correctAnswer && /^[A-Ea-e]$/.test(q.correctAnswer),
        severity: 'warning',
        message: 'Missing or invalid correctAnswer (expected A-E)',
        appliesTo: ['quant', 'cr', 'rc', 'ds']
    },
    // CR - passage
    {
        field: 'content.passage',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            return !!c?.passage && (c.passage as string).length > 10;
        },
        severity: 'error',
        message: 'Missing or too short passage',
        appliesTo: ['cr']
    },
    // RC - passage
    {
        field: 'content.passage',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            return !!c?.passage && (c.passage as string).length > 20;
        },
        severity: 'error',
        message: 'Missing or too short passage',
        appliesTo: ['rc']
    },
    // DS - statements
    {
        field: 'content.statements',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            return Array.isArray(c?.statements) && (c.statements as unknown[]).length === 2;
        },
        severity: 'error',
        message: 'DS questions should have exactly 2 statements',
        appliesTo: ['ds']
    },
    // DI-GI - statements with dropdowns
    {
        field: 'content.statements',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            if (!Array.isArray(c?.statements)) return false;
            const stmts = c.statements as Array<Record<string, unknown>>;
            return stmts.length > 0 && stmts.every(s => Array.isArray(s.dropdowns) && (s.dropdowns as unknown[]).length > 0);
        },
        severity: 'error',
        message: 'GI questions must have statements with dropdowns',
        appliesTo: ['di-gi']
    },
    // DI-TA - table and statements
    {
        field: 'content.table',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            const table = c?.table as Record<string, unknown> | undefined;
            return !!table && Array.isArray(table.headers) && Array.isArray(table.rows);
        },
        severity: 'error',
        message: 'TA questions must have a table with headers and rows',
        appliesTo: ['di-ta']
    },
    // DI-TPA - rows and correctAnswers
    {
        field: 'content.rows',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            return Array.isArray(c?.rows) && (c.rows as unknown[]).length > 0;
        },
        severity: 'error',
        message: 'TPA questions must have rows',
        appliesTo: ['di-tpa']
    },
    {
        field: 'content.correctAnswers',
        check: (q) => {
            const c = q.content as Record<string, unknown>;
            return !!c?.correctAnswers;
        },
        severity: 'warning',
        message: 'TPA questions missing correctAnswers',
        appliesTo: ['di-tpa']
    }
];

// MSR-specific rules (different structure)
const MSR_RULES: ValidationRule[] = [
    {
        field: 'dataSources',
        check: (q) => {
            const ds = q.dataSources as Record<string, unknown> | undefined;
            return !!ds && Array.isArray(ds.tabs) && (ds.tabs as unknown[]).length > 0;
        },
        severity: 'error',
        message: 'MSR questions must have dataSources with tabs',
        appliesTo: ['di-msr']
    },
    {
        field: 'questions',
        check: (q) => Array.isArray(q.questions) && q.questions.length > 0,
        severity: 'error',
        message: 'MSR questions must have a non-empty questions array',
        appliesTo: ['di-msr']
    }
];

const ALL_RULES = [...UNIVERSAL_RULES, ...CONSISTENCY_RULES, ...CONTENT_RULES, ...MSR_RULES];

/**
 * Normalize extracted question data for consistency
 */
export function normalizeQuestion(question: ExtractedQuestion): ExtractedQuestion {
    return {
        ...question,
        source: 'gmat-hero', // Always normalize source
        difficulty: (question.difficulty || '').toLowerCase(),
        section: (question.section || '').toLowerCase(),
        questionType: (question.questionType || '').toLowerCase(),
    };
}

/**
 * Validate a single question and return any errors/warnings
 */
export function validateQuestion(
    question: ExtractedQuestion,
    categoryId: string,
    categoryName: string,
    questionIndex: number
): BatchError[] {
    const issues: BatchError[] = [];

    for (const rule of ALL_RULES) {
        // Check if rule applies to this question type
        if (rule.appliesTo && rule.appliesTo.length > 0) {
            if (!rule.appliesTo.includes(question.questionType) && !rule.appliesTo.includes(question.category?.toLowerCase())) {
                continue;
            }
        }

        if (!rule.check(question)) {
            issues.push({
                categoryId,
                categoryName,
                questionIndex,
                questionLink: question.questionLink || '',
                error: rule.message,
                severity: rule.severity,
                field: rule.field
            });
        }
    }

    return issues;
}

/**
 * Validate a batch of questions and generate a report
 */
export function validateBatch(
    questions: ExtractedQuestion[],
    categoryId: string,
    categoryName: string
): ValidationReport {
    const errors: BatchError[] = [];
    const warnings: BatchError[] = [];

    for (let i = 0; i < questions.length; i++) {
        const normalized = normalizeQuestion(questions[i]);
        questions[i] = normalized; // Mutate in place for normalization

        const issues = validateQuestion(normalized, categoryId, categoryName, i);
        for (const issue of issues) {
            if (issue.severity === 'error') {
                errors.push(issue);
            } else {
                warnings.push(issue);
            }
        }
    }

    return {
        totalQuestions: questions.length,
        validQuestions: questions.length - new Set(errors.map(e => e.questionIndex)).size,
        errors,
        warnings
    };
}
