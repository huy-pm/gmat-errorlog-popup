/**
 * GMAT OG Autoscraping - Loader
 * Entry point that creates the popup UI and initializes the extraction process
 */

(async function () {
    // Determine base path for module imports
    const scriptUrl = document.currentScript?.src || '';
    const basePath = scriptUrl ? scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1) :
        'https://huy-pm.github.io/gmat-errorlog-popup/gmat-og-autoscraping/';

    // Add cache buster for development
    const cacheBuster = `?v=${Date.now()}`;

    try {
        console.log('🚀 GMAT OG DI Autoscraping - Loading...');

        // Import core module
        const core = await import(`${basePath}core.js${cacheBuster}`);

        // Create popup window
        const popup = window.open('', 'GMAT OG DI Extractor', 'width=600,height=500,scrollbars=yes');

        if (!popup) {
            console.error('❌ Could not open popup window. Please allow popups for this site.');
            alert('Could not open popup window. Please allow popups for this site.');
            return;
        }

        // Write popup HTML
        popup.document.write(`
<!DOCTYPE html>
<html>
<head>
    <title>GMAT OG DI Extractor</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; background: #f5f5f5; }
        h2 { color: #333; text-align: center; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
        .controls { text-align: center; margin: 20px 0; }
        button { 
            padding: 12px 24px; 
            margin: 5px; 
            color: white; 
            border: none; 
            cursor: pointer; 
            border-radius: 6px; 
            font-size: 16px;
            transition: background 0.3s;
        }
        button:disabled { background-color: #cccccc !important; cursor: not-allowed; }
        #start-btn { background-color: #4CAF50; }
        #start-btn:hover:not(:disabled) { background-color: #45a049; }
        #stop-btn { background-color: #f44336; }
        #stop-btn:hover:not(:disabled) { background-color: #d32f2f; }
        .status { 
            text-align: center; 
            margin: 20px 0; 
            font-size: 18px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .count { 
            text-align: center; 
            font-size: 28px; 
            font-weight: bold; 
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
        .instructions { 
            background: white; 
            padding: 15px; 
            border-left: 4px solid #2196F3; 
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .supported-types {
            background: #e8f5e9;
            padding: 15px;
            border-left: 4px solid #4CAF50;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .supported-types ul { margin: 5px 0; padding-left: 20px; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
    </style>
</head>
<body>
    <h2>GMAT OG DI Extractor</h2>
    <p class="subtitle">Data Interpretation Question Scraper</p>
    
    <div class="supported-types">
        <strong>Supported Question Types:</strong>
        <ul>
            <li>Graphics Interpretation (GI)</li>
            <li>Multi-Source Reasoning (MSR)</li>
            <li>Table Analysis (TA)</li>
            <li>Two-Part Analysis (TPA)</li>
            <li>Data Sufficiency (DS)</li>
        </ul>
    </div>
    
    <div class="instructions">
        <strong>Instructions:</strong>
        <ol>
            <li>Navigate to a GMAT OG quiz review page with the question list</li>
            <li>Click "Start" to begin extracting DI questions</li>
            <li>The script will automatically navigate through all questions</li>
            <li>Click "Stop" to stop early and save extracted questions</li>
        </ol>
    </div>
    
    <div class="controls">
        <label style="display: block; margin-bottom: 15px; font-size: 16px;">
            <input type="checkbox" id="incorrect-only" style="width: 18px; height: 18px; margin-right: 8px; vertical-align: middle;">
            Extract incorrect questions only
        </label>
        <button id="start-btn">Start</button>
        <button id="stop-btn" disabled>Stop</button>
    </div>
    
    <div class="status">Status: <span id="status">Ready</span></div>
    
    <div class="count">
        <span class="success">✓ <span id="success-count">0</span></span> | 
        <span class="error">✗ <span id="skipped-count">0</span></span> | 
        Total: <span id="total-count">0</span>
    </div>
</body>
</html>
        `);

        // Attach event handlers
        popup.document.getElementById('start-btn').addEventListener('click', () => {
            core.startExtraction(popup);
        });

        popup.document.getElementById('stop-btn').addEventListener('click', () => {
            core.stopExtraction();
        });

        console.log('✅ GMAT OG DI Autoscraping - Ready!');

    } catch (error) {
        console.error('❌ Error initializing GMAT OG DI Autoscraping:', error);
    }
})();
