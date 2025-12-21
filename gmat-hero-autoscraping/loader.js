/**
 * GMAT Hero Autoscraping - Loader
 * Entry point that detects the page and loads appropriate modules
 */

(async function () {
    'use strict';

    // Cache busting for development
    const cacheBuster = `?v=${Date.now()}`;

    // Get the base path for module imports
    const getBasePath = () => {
        const currentScript = document.currentScript || document.querySelector('script[src*="loader.js"]');
        if (currentScript && currentScript.src) {
            const scriptUrl = new URL(currentScript.src);
            // Remove query params and get the path without the filename
            const pathWithoutQuery = scriptUrl.origin + scriptUrl.pathname;
            // Remove loader.js from the end to get base path
            return pathWithoutQuery.replace(/loader\.js$/, '');
        }
        return './';
    };

    const basePath = getBasePath();

    try {
        console.log('🚀 GMAT Hero Autoscraping - Loading...');

        // Dynamically import modules
        const utils = await import(`${basePath}utils.js${cacheBuster}`);
        const core = await import(`${basePath}core.js${cacheBuster}`);

        // Detect initial question type
        const initialType = utils.detectQuestionType();
        console.log('Detected initial question type:', initialType);

        // Create popup with appropriate title
        const typeLabels = {
            'quant': 'Quant',
            'cr': 'Critical Reasoning',
            'rc': 'Reading Comprehension',
            'di-gi': 'Graphics Interpretation (GI)',
            'di-msr': 'Multi-Source Reasoning (MSR)',
            'di-ta': 'Table Analysis (TA)',
            'di-tpa': 'Two-Part Analysis (TPA)'
        };

        const section = utils.getSectionFromType(initialType);
        const sectionLabels = {
            'quant': '📐 Quantitative',
            'verbal': '📖 Verbal',
            'di': '📊 Data Insights'
        };

        const title = `GMAT Hero - ${sectionLabels[section] || 'Auto'} Extractor`;
        core.createPopup(title);
        core.updateTypeBadge(initialType);

        console.log('✅ GMAT Hero Autoscraping ready!');
        console.log('Click "Start" in the popup to begin extraction.');

    } catch (error) {
        console.error('❌ Error initializing GMAT Hero Autoscraping:', error);
        alert('Error loading GMAT Hero Autoscraping: ' + error.message);
    }
})();
