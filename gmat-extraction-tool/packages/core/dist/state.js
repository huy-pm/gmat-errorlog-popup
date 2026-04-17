import { getPracticeUrl } from './utils/dom.js';
const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
export const state = {
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
export function setQuestionExtractor(fn) {
    state.extractQuestionFn = fn;
}
//# sourceMappingURL=state.js.map