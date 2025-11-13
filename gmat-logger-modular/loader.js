/**
 * GMAT Logger Modular - Loader
 * Entry point that detects the page and loads appropriate modules
 */

(async function() {
  'use strict';

  // Cache busting for development - add timestamp to all module imports
  const cacheBuster = `?v=${Date.now()}`;

  // Dynamically import all modules with cache busting
  const { CONFIG, detectQuestionSource } = await import(`./utils.js${cacheBuster}`);
  const { createModal, setQuestionExtractor } = await import(`./core.js${cacheBuster}`);

  console.log('⚡ GMAT Quick Log Bookmarklet (Modular) v' + CONFIG.version);

  try {
    // Detect which site we're on
    const currentUrl = window.location.href;
    const source = detectQuestionSource(currentUrl);
    console.log('Detected page source:', source);

    // Load the appropriate extractor based on the page
    if (source === 'gmatclub') {
      console.log('Loading GMATClub extractor...');
      // Dynamically import GMATClub extractor
      const { extractGMATClubQuestion } = await import(`./extractors/gmatclub.js${cacheBuster}`);
      setQuestionExtractor(extractGMATClubQuestion);
      console.log('GMATClub extractor loaded');
    } else if (source === 'gmathero') {
      console.log('Loading GMAT Hero extractor...');
      // Dynamically import GMAT Hero extractor
      const { extractGMATHeroQuestion } = await import(`./extractors/gmathero.js${cacheBuster}`);
      setQuestionExtractor(extractGMATHeroQuestion);
      console.log('GMAT Hero extractor loaded');
    } else {
      console.log('No specific extractor for this page (will work without question extraction)');
      // No extractor needed, modal will work without question extraction
    }

    // Create and display the modal
    await createModal();

  } catch (error) {
    console.error('Error initializing GMAT Logger:', error);
    alert('Error loading GMAT Logger: ' + error.message);
  }
})();
