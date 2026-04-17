// Re-export extractors
// We assume they are now available as modules or we rewrite them slightly to TS
// For now, let's try to import the JS files. TypeScript might complain if allowJs is false, but we set strict.
// We might need to quickly "ts-ify" them or provide d.ts
// I'll just import them as any for now or basic types
// Since they are JS files, we can just export them if TS allows.
// Or I can rewrite them. They are likely simple DOM logic.
// Let's assume I can import them.
import { extractGMATClubQuestion } from './extractors/gmatclub';
import { extractGMATHeroQuestion } from './extractors/gmathero';
import { extractGMATOGQuestion } from './extractors/gmatOG';
import { detectQuestionSource } from './utils/dom';
export const getExtractor = (url) => {
    const source = detectQuestionSource(url);
    if (source === 'gmatclub')
        return extractGMATClubQuestion;
    if (source === 'gmathero')
        return extractGMATHeroQuestion;
    if (source === 'gmatog')
        return extractGMATOGQuestion;
    return null;
};
//# sourceMappingURL=extractors.js.map