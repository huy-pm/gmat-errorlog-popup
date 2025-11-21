/**
 * GMAT Logger Side Panel - Loader
 * Entry point that detects the page and loads appropriate modules
 */

(async function() {
  'use strict';

  // Cache busting for development - add timestamp to all module imports
  const cacheBuster = `?v=${Date.now()}`;

  // Get the base path for module imports
  const getBasePath = () => {
    // Try to detect if we're loading from a CDN or local file
    const currentScript = document.currentScript || document.querySelector('script[src*="loader.js"]');
    if (currentScript && currentScript.src) {
      const scriptUrl = new URL(currentScript.src);
      return scriptUrl.href.replace('loader.js', '');
    }
    // Fallback for bookmarklet or manual injection
    return './';
  };

  const basePath = getBasePath();

  try {
    // Dynamically import all modules with cache busting
    const { CONFIG, detectQuestionSource } = await import(`${basePath}utils.js${cacheBuster}`);
    const { createSidebar, setQuestionExtractor } = await import(`${basePath}core.js${cacheBuster}`);

    console.log('⚡ GMAT Quick Log Sidebar (Modular) v' + CONFIG.version);

    // Detect which site we're on
    const currentUrl = window.location.href;
    const source = detectQuestionSource(currentUrl);
    console.log('Detected page source:', source);

    // Load the appropriate extractor based on the page
    if (source === 'gmatclub') {
      console.log('Loading GMATClub extractor...');
      const { extractGMATClubQuestion } = await import(`${basePath}extractors/gmatclub.js${cacheBuster}`);
      setQuestionExtractor(extractGMATClubQuestion);
      console.log('GMATClub extractor loaded');
    } else if (source === 'gmathero') {
      console.log('Loading GMAT Hero extractor...');
      const { extractGMATHeroQuestion } = await import(`${basePath}extractors/gmathero.js${cacheBuster}`);
      setQuestionExtractor(extractGMATHeroQuestion);
      console.log('GMAT Hero extractor loaded');
    } else {
      console.log('No specific extractor for this page (will work without question extraction)');
    }

    // Create and display the sidebar
    await createSidebar();

  } catch (error) {
    console.error('Error initializing GMAT Logger:', error);
    alert('Error loading GMAT Logger: ' + error.message);
  }
})();
