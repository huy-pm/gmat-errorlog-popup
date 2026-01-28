
import {
    CONFIG,
    detectQuestionSource,
    createSidebar,
    setQuestionExtractor,
    getExtractor,
    setAuthProvider
} from '@gmat-extraction/core';
import * as Auth from './auth';

// Setup Auth
setAuthProvider(Auth);

(async function () {
    'use strict';

    console.log('⚡ GMAT Quick Log Sidebar (Modular) v' + CONFIG.version);

    const currentUrl = window.location.href;
    const source = detectQuestionSource(currentUrl);
    console.log('Detected page source:', source);

    // Load the appropriate extractor
    const extractor = getExtractor(currentUrl);
    if (extractor) {
        setQuestionExtractor(extractor);
        console.log('Extractor loaded for source:', source);
    } else {
        console.log('No specific extractor for this page (will work without question extraction)');
    }

    // Create and display the sidebar
    await createSidebar();
})();
