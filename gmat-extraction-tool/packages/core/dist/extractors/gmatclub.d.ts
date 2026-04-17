/**
 * Main export: Extract question from GMATClub page
 */
export declare function extractGMATClubQuestion(): {
    questionLink: string;
    source: string;
    questionType: string;
    difficulty: string;
    section: string;
    category: string;
    content: {
        questionText: any;
        answerChoices: any[];
    };
} | {
    questionLink: string;
    source: string;
    questionType: string;
    difficulty: string;
    section: string;
    content: {
        passage: string;
        questionText: string;
        answerChoices: any[];
    };
} | null;
