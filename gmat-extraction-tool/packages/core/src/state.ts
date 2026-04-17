
import { LogData, Category, Tag, ExtractorFn } from './types.js';
import { getPracticeUrl } from './utils/dom.js';

export interface AppState {
    sidebarWidth: number;
    isCollapsed: boolean;
    activeTab: 'log' | 'ai' | 'settings';
    isAnalyzing: boolean;
    isRefreshing: boolean;
    isSubmitting: boolean;
    isInitialLoad: boolean;
    apiKey: string;
    logData: LogData;
    aiReasoning: string | null;
    categories: Category[];
    allTags: Tag[];
    extractQuestionFn: ExtractorFn | null;
    lastUrl: string;
}

const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

export const state: AppState = {
    sidebarWidth: 400,
    isCollapsed: false,
    activeTab: 'log',
    isAnalyzing: false,
    isRefreshing: false,
    isSubmitting: false,
    isInitialLoad: true,
    apiKey: typeof localStorage !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '') : '',
    logData: {
        url: getPracticeUrl(currentUrl),
        notes: '',
        tags: [],
        source: typeof document !== 'undefined' ? document.title : ''
    },
    aiReasoning: null,
    categories: [],
    allTags: [],
    extractQuestionFn: null,
    lastUrl: getPracticeUrl(currentUrl)
};

export function setQuestionExtractor(fn: ExtractorFn) {
    state.extractQuestionFn = fn;
}
