/**
 * Batch Autoscraping - Shared Types
 */

export interface CategoryDefinition {
    id: string;
    name: string;
    section: string; // 'verbal' | 'quant' | 'di'
    url: string;
    questionCount: number;
}

export interface TabWorker {
    tabId: number;
    categoryId: string | null;
    categoryName: string | null;
    status: 'idle' | 'scraping' | 'navigating';
    questionsExtracted: number;
    currentQuestionIndex: number;
}

export interface BatchState {
    status: 'idle' | 'running' | 'paused' | 'complete';
    queue: CategoryDefinition[];
    workers: TabWorker[];
    concurrency: number;
    totalCategories: number;
    results: Record<string, ExtractedQuestion[]>;
    categoryNames: Record<string, string>;
    errors: BatchError[];
    startedAt: string | null;
    stats: BatchStats;
    incorrectOnly: boolean;
    originTabId: number | null;
}

export interface BatchStats {
    totalCategories: number;
    completedCategories: number;
    totalQuestions: number;
    totalErrors: number;
    skippedQuestions: number;
}

export interface BatchError {
    categoryId: string;
    categoryName: string;
    questionIndex: number;
    questionLink: string;
    error: string;
    severity: 'error' | 'warning';
    field?: string;
}

export interface ExtractedQuestion {
    questionLink: string;
    gmatClubLink?: string | null;
    source: string;
    difficulty: string;
    section: string;
    questionType: string;
    category: string;
    topic?: string;
    correctAnswer?: string | null;
    content: Record<string, unknown>;
    // MSR-specific
    questionSetLink?: string;
    dataSources?: Record<string, unknown>;
    questions?: Record<string, unknown>[];
    _tabSignature?: string;
}

export interface ValidationReport {
    totalQuestions: number;
    validQuestions: number;
    errors: BatchError[];
    warnings: BatchError[];
}
