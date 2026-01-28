/**
 * GMAT Logger Modular - GMAT Official Practice Extractor
 * Extracts RC and CR questions from gmatofficialpractice.mba.com
 */
/**
 * Main export: Extract question from GMAT Official Practice page
 */
export declare function extractGMATOGQuestion(): {
    questionLink: string;
    source: string;
    questionType: string;
    difficulty: string;
    section: string;
    selectedAnswer: string;
    correctAnswer: string;
    timeSpent: any;
    category: string;
    content: {
        passage: string;
        questionText: string;
        answerChoices: any[];
    };
} | null;
