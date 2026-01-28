
import { QuestionData, Category, Tag } from './types.js';
import {
    sectionMappings,
    difficultyMappings,
    sourceMappings,
    allSectionMappings,
    allDifficultyMappings,
    detectSourceFromLink
} from './utils/dom.js';

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

export function parseNotes(notes: string, categories: Category[]): ParsedNotes {
    let originalNotes = notes;
    let selectedAnswer, correctAnswer, timeSpent;

    // Extract and remove selected answer, correct answer, and time using regex
    const selectedMatch = originalNotes.match(/Selected:\s*([A-E])/i);
    if (selectedMatch) {
        selectedAnswer = selectedMatch[1].toUpperCase();
        // Remove "Selected: X" from the notes
        originalNotes = originalNotes.replace(/Selected:\s*[A-E],?\s*/i, '');
    }

    const correctMatch = originalNotes.match(/Correct:\s*([A-E])/i);
    if (correctMatch) {
        correctAnswer = correctMatch[1].toUpperCase();
        // Remove "Correct: X" from the notes
        originalNotes = originalNotes.replace(/Correct:\s*[A-E],?\s*/i, '');
    }

    const timeMatch = originalNotes.match(/Time:\s*(\d{2}:\d{2})/);
    if (timeMatch) {
        timeSpent = timeMatch[1];
        // Remove "Time: XX:XX" from the notes
        originalNotes = originalNotes.replace(/Time:\s*\d{2}:\d{2},?\s*/i, '');
    }

    // Clean up any remaining " - " or extra commas
    originalNotes = originalNotes.replace(/\s*-\s*,\s*/g, ' - ');
    originalNotes = originalNotes.replace(/\s+-\s*$/gm, ''); // Remove trailing " -" at end of lines (with any preceding whitespace)
    originalNotes = originalNotes.replace(/\s*-\s*\n+/g, '\n'); // Remove " - " before one or more newlines
    originalNotes = originalNotes.trim();

    const normalizedNotes = originalNotes.toLowerCase().trim();
    const words = normalizedNotes.split(/\s+/);
    let section, category, difficulty, source;
    const usedWords = new Set<number>();

    // Parse section, difficulty, source
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!usedWords.has(i) && sectionMappings[word]) {
            section = sectionMappings[word];
            usedWords.add(i);
            break;
        }
    }
    for (let i = 0; i < words.length; i++) {
        if (usedWords.has(i)) continue;
        const word = words[i];
        if (difficultyMappings[word]) {
            difficulty = difficultyMappings[word];
            usedWords.add(i);
            break;
        }
    }
    for (let i = 0; i < words.length; i++) {
        if (usedWords.has(i)) continue;
        const word = words[i];
        if (sourceMappings[word]) {
            source = sourceMappings[word];
            usedWords.add(i);
            break;
        }
    }

    // Parse category using shortName or full name
    for (const cat of categories) {
        const categoryWords = cat.name.toLowerCase().split(' ');

        if (categoryWords.length > 1) {
            for (let i = 0; i <= words.length - categoryWords.length; i++) {
                const wordIndices = Array.from({ length: categoryWords.length }, (_, idx) => i + idx);
                if (wordIndices.some(idx => usedWords.has(idx))) continue;

                const matchesCategory = categoryWords.every((catWord, idx) =>
                    words[i + idx] === catWord
                );

                if (matchesCategory) {
                    category = cat.name;
                    if (!section) {
                        section = cat.section;
                    }
                    wordIndices.forEach(idx => usedWords.add(idx));
                    break;
                }
            }
            if (category) break;
        }
    }

    if (!category) {
        for (let i = 0; i < words.length; i++) {
            if (usedWords.has(i)) continue;
            const word = words[i];

            const categoryByShort = categories.find(cat =>
                cat.shortName?.toLowerCase() === word
            );

            if (categoryByShort) {
                category = categoryByShort.name;
                if (!section) {
                    section = categoryByShort.section;
                }
                usedWords.add(i);
                break;
            }

            const categoryByName = categories.find(cat =>
                cat.name.toLowerCase() === word
            );

            if (categoryByName) {
                category = categoryByName.name;
                if (!section) {
                    section = categoryByName.section;
                }
                usedWords.add(i);
                break;
            }
        }
    }

    // Extract remaining words as notes
    if (usedWords.size === 0) {
        return { section, category, difficulty, source, selectedAnswer, correctAnswer, timeSpent, extractedNotes: originalNotes || undefined };
    }

    const allParts = originalNotes.split(/(\s+)/);
    const keptParts = [];
    let normalizedWordIndex = 0;

    for (const part of allParts) {
        if (/^\s+$/.test(part)) {
            keptParts.push(part);
        } else {
            if (!usedWords.has(normalizedWordIndex)) {
                keptParts.push(part);
            }
            normalizedWordIndex++;
        }
    }

    let extractedNotes = keptParts.join('');
    extractedNotes = extractedNotes.replace(/^[ \t]+/, '');
    extractedNotes = extractedNotes.replace(/[ \t]+$/, '');

    // Remove any remaining standalone dashes with surrounding whitespace
    extractedNotes = extractedNotes.replace(/^\s*-\s*/gm, ''); // Remove leading dash on any line
    extractedNotes = extractedNotes.trim();

    return { section, category, difficulty, source, selectedAnswer, correctAnswer, timeSpent, extractedNotes: extractedNotes || undefined };
}

export function parseNotesAndLink(notes: string, questionLink: string, categories: Category[]): ParsedNotes {
    const notesResult = parseNotes(notes, categories);
    const linkSource = questionLink ? detectSourceFromLink(questionLink) : undefined;
    const finalSource = linkSource || notesResult.source;

    return {
        ...notesResult,
        source: finalSource,
    };
}

export interface Suggestion {
    type: 'section' | 'difficulty' | 'source' | 'category';
    shortName: string;
    fullName: string;
    startIndex: number;
    endIndex: number;
}

export function getAutoSuggestions(input: string, cursorPosition: number, parsedInfo: ParsedNotes | null, categories: Category[]): Suggestion[] {
    const beforeCursor = input.substring(0, cursorPosition).toLowerCase();
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1] || '';
    if (currentWord.length < 1) return [];

    const suggestions: Suggestion[] = [];
    const startIndex = cursorPosition - currentWord.length;

    const hasSection = parsedInfo?.section;
    const hasDifficulty = parsedInfo?.difficulty;
    const hasSource = parsedInfo?.source;
    const hasCategory = parsedInfo?.category;

    if (!hasSection) {
        Object.entries(allSectionMappings).forEach(([key, value]) => {
            if (key.startsWith(currentWord) && key !== currentWord) {
                let displayName = value === 'di' ? 'DI' : value.charAt(0).toUpperCase() + value.slice(1);
                suggestions.push({ type: 'section', shortName: key, fullName: displayName, startIndex, endIndex: cursorPosition });
            }
        });
    }

    if (!hasDifficulty) {
        Object.entries(allDifficultyMappings).forEach(([key, value]) => {
            if (key.startsWith(currentWord) && key !== currentWord) {
                suggestions.push({ type: 'difficulty', shortName: key, fullName: value.charAt(0).toUpperCase() + value.slice(1), startIndex, endIndex: cursorPosition });
            }
        });
    }

    if (!hasSource) {
        Object.entries(sourceMappings).forEach(([key, value]) => {
            if (key.startsWith(currentWord) && key !== currentWord) {
                suggestions.push({ type: 'source', shortName: key, fullName: value, startIndex, endIndex: cursorPosition });
            }
        });
    }

    if (!hasCategory) {
        categories.forEach(category => {
            if (category.shortName && category.shortName.toLowerCase().startsWith(currentWord) && category.shortName.toLowerCase() !== currentWord) {
                suggestions.push({
                    type: 'category',
                    shortName: category.shortName.toLowerCase(),
                    fullName: category.name,
                    startIndex,
                    endIndex: cursorPosition,
                });
            }

            const categoryNameLower = category.name.toLowerCase();
            const inputFromStart = beforeCursor.trim();
            const lastTwoWords = words.slice(-2).join(' ');
            const lastThreeWords = words.slice(-3).join(' ');

            const possibleMatches = [currentWord, lastTwoWords, lastThreeWords, inputFromStart];

            for (const match of possibleMatches) {
                if (match && match.length >= 1 && categoryNameLower.startsWith(match) && categoryNameLower !== match) {
                    const matchStartIndex = cursorPosition - match.length;

                    suggestions.push({
                        type: 'category',
                        shortName: categoryNameLower,
                        fullName: category.name,
                        startIndex: matchStartIndex,
                        endIndex: cursorPosition,
                    });
                    break;
                }
            }
        });
    }

    return suggestions.sort((a, b) => a.shortName.length - b.shortName.length || a.shortName.localeCompare(b.shortName)).slice(0, 1);
}

export function applySuggestion(input: string, suggestion: Suggestion, cursorPosition: number): { newInput: string, newCursorPosition: number } {
    const before = input.substring(0, suggestion.startIndex);
    const after = input.substring(suggestion.endIndex);
    const completionText = suggestion.type === 'category' ? suggestion.fullName : suggestion.shortName;
    const newInput = before + completionText + ' ' + after;
    const newCursorPosition = suggestion.startIndex + completionText.length + 1;
    return { newInput, newCursorPosition };
}
