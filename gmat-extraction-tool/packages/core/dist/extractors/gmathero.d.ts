/**
 * GMAT Logger Modular - GMAT Hero Extractor
 * Extracts questions from gmat-hero-v2.web.app pages
 */
/**
 * Returns the extraction log from the most recent extractGMATHeroQuestion() call.
 * Call this after extraction to see why fields may be missing.
 *
 * Example:
 *   const data = extractGMATHeroQuestion();
 *   const { errors, warnings } = getExtractionReport();
 */
export declare function getExtractionReport(): {
    errors: never[];
    warnings: never[];
};
/**
 * Reset MSR module state. Call this when beginning a new extraction session
 * (e.g., when the user navigates to a different question set).
 */
export declare function resetMsrState(): void;
/**
 * Main export: Extract question from GMAT Hero page
 */
export declare function extractGMATHeroQuestion(): Promise<any> | {
    questionLink: string;
    source: string;
    questionType: string;
    difficulty: string;
    section: string;
    selectedAnswer: string;
    correctAnswer: string;
    timeSpent: string;
    category: string;
    content: {
        questionText: any;
        answerChoices: any[];
        image: string | null;
        table: {
            headers: any[];
            rows: any[];
        } | null;
    };
} | {
    questionLink: string;
    source: string;
    difficulty: string;
    section: string;
    questionType: string;
    category: string;
    correctAnswer: string;
    content: {
        questionText: any;
        statements: any[];
        image: string | null;
        table: {
            headers: any[];
            rows: any[];
        } | null;
    };
} | {
    questionLink: string;
    source: string;
    questionType: string;
    difficulty: string;
    section: string;
    selectedAnswer: string;
    correctAnswer: string;
    timeSpent: string;
    category: string;
    content: {
        passage: string;
        questionText: string;
        answerChoices: any[];
    };
} | {
    questionLink: string;
    source: string;
    difficulty: string;
    section: string;
    questionType: string;
    category: string;
    content: {
        introText: string;
        table: {
            headers: any[];
            rows: any[];
        };
        questionInstruction: string;
        choiceLabels: string[];
        statements: {
            text: any;
            correctAnswer: string | null;
        }[];
    };
} | {
    questionLink: string;
    source: string;
    difficulty: string;
    section: string;
    questionType: string;
    category: string;
    content: {
        questionText: string;
        choiceLabels: any[];
        rows: {
            text: any;
            optionValue: any;
        }[];
        correctAnswers: {
            column1: null;
            column2: null;
        };
    };
} | null;
