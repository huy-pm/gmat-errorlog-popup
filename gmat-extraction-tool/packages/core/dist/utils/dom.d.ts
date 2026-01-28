/**
 * GMAT Logger Side Panel - Shared Utilities
 * Shared constants, icons, and helper functions used across modules
 */
import { QuestionData } from '../types.js';
export declare const CONFIG: {
    apiUrl: string;
    devUrl: string;
    version: string;
};
export declare const baseUrl: string;
/**
 * Convert review URL to practice URL for GMAT Hero
 * Example: /review/62 -> /practice/62
 */
export declare function getPracticeUrl(url: string): string;
export declare const ICONS: {
    zap: string;
    x: string;
    sparkles: string;
    link: string;
    tag: string;
    fileText: string;
    loader: string;
    brain: string;
    gripVertical: string;
    settings: string;
    refresh: string;
    menu: string;
    checkCircle: string;
    user: string;
    eye: string;
    eyeOff: string;
    lock: string;
};
export declare const sectionMappings: Record<string, string>;
export declare const allSectionMappings: Record<string, string>;
export declare const difficultyMappings: Record<string, string>;
export declare const allDifficultyMappings: Record<string, string>;
export declare const sourceMappings: Record<string, string>;
export declare const urlSourceMappings: {
    pattern: RegExp;
    source: string;
}[];
export declare const sourceDisplayLabels: Record<string, string>;
/**
 * Get display label for a source value
 * @param {string} source - The source value (e.g., 'gmat-club')
 * @returns {string} - The display label (e.g., 'GMAT Club') or the original source if not found
 */
export declare function getSourceDisplayLabel(source: string | null | undefined): string;
/**
 * Decode HTML entities
 */
export declare function decodeHtmlEntities(text: string): string;
/**
 * Detect source from URL
 */
export declare function detectSourceFromLink(url: string | null): string | undefined;
/**
 * Detect which question source we're on
 */
export declare function detectQuestionSource(url: string | null): string | null;
/**
 * Create a styled badge element
 */
export declare function createBadge(text: string, variant: 'green' | 'red' | 'default'): HTMLElement;
/**
 * Show status message in the UI
 * @param message - text to show
 * @param type - style type
 * @param rootOrDoc - root element to search in (document or shadow root)
 */
export declare function showStatus(message: string, type: 'success' | 'error' | 'default', rootOrDoc?: any): void;
/**
 * Enrich question JSON with bookmarklet data
 */
export declare function enrichquestionData(questionData: QuestionData | null, payload: any): QuestionData | null;
/**
 * Patterns that indicate a sentence-completion style question without a question mark.
 * These are incomplete sentences that the answer choices complete.
 * Examples:
 *   - "...best serves as part of an argument that"
 *   - "...most strongly supports which of the following"
 *   - "The consultant responds to the lawmaker's argument by"
 */
export declare const COMPLETION_PATTERNS: RegExp[];
/**
 * Check if a text matches any sentence-completion style question pattern.
 * @param {string} text - The text to check (should be trimmed)
 * @returns {boolean} - True if the text matches a completion pattern
 */
export declare function isCompletionStyleQuestion(text: string | null): boolean;
