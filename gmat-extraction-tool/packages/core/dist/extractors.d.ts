import { extractGMATClubQuestion } from './extractors/gmatclub';
import { extractGMATHeroQuestion } from './extractors/gmathero';
export declare const getExtractor: (url: string) => typeof extractGMATClubQuestion | typeof extractGMATHeroQuestion | null;
