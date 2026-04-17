export interface QuestionData {
    section?: string | null;
    category?: string | null;
    difficulty?: string | null;
    source?: string | null;
    questionLink?: string | null;
    questionType?: string | null;
    questionId?: string | null;
    selectedAnswer?: string | null;
    correctAnswer?: string | null;
    timeSpent?: string | null;
    extractedNotes?: string | null;
    originalNotes?: string | null;
    tags?: string[];
    [key: string]: any;
}
export interface Category {
    id: string;
    name: string;
    section: string;
    shortName?: string | null;
}
export interface Tag {
    id: string;
    name: string;
}
export interface LogData {
    url: string;
    notes: string;
    tags: string[];
    source: string;
}
export interface ExtractorFn {
    (): Promise<QuestionData | null> | QuestionData | null;
}
