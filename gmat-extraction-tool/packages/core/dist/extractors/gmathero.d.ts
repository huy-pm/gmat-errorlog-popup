/**
 * GMAT Logger Modular - GMAT Hero Extractor
 * Extracts questions from gmat-hero-v2.web.app pages
 */
/**
 * Main export: Extract question from GMAT Hero page
 */
export declare function extractGMATHeroQuestion(): {
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
} | null;
