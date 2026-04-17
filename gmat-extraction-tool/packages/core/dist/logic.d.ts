import { Category } from './types.js';
export interface ParsedNotes {
    section?: string;
    category?: string;
    difficulty?: string;
    source?: string;
    selectedAnswer?: string;
    correctAnswer?: string;
    timeSpent?: string;
    extractedNotes?: string;
}
export declare function parseNotes(notes: string, categories: Category[]): ParsedNotes;
export declare function parseNotesAndLink(notes: string, questionLink: string, categories: Category[]): ParsedNotes;
export interface Suggestion {
    type: 'section' | 'difficulty' | 'source' | 'category';
    shortName: string;
    fullName: string;
    startIndex: number;
    endIndex: number;
}
export declare function getAutoSuggestions(input: string, cursorPosition: number, parsedInfo: ParsedNotes | null, categories: Category[]): Suggestion[];
export declare function applySuggestion(input: string, suggestion: Suggestion, cursorPosition: number): {
    newInput: string;
    newCursorPosition: number;
};
