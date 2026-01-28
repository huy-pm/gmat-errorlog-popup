import { LogData, Category, Tag, ExtractorFn } from './types.js';
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
export declare const state: AppState;
export declare function setQuestionExtractor(fn: ExtractorFn): void;
