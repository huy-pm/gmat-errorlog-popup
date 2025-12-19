/**
 * Bookmarklet Manager
 * A single bookmarklet that displays all your other bookmarklets as clickable buttons
 * 
 * To use:
 * 1. Add your bookmarklets to the BOOKMARKLETS array below
 * 2. Minify this entire script
 * 3. Create a single bookmark with the minified code as the URL (prefix with javascript:)
 * 4. Click the bookmark to show the popup with all your bookmarklets
 */

(function () {
    // ============================================
    // DYNAMIC BASE URL DETECTION
    // ============================================
    // Find the script's own src and extract the base URL
    // This allows the same code to work on production (github.io) and localhost
    function getBaseUrl() {
        // Find all scripts and look for bookmarklet-manager.js
        const scripts = document.querySelectorAll('script[src*="bookmarklet-manager.js"]');
        if (scripts.length > 0) {
            const scriptSrc = scripts[scripts.length - 1].src; // Get the most recent one
            // Remove the filename to get the base URL
            const baseUrl = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));
            return baseUrl;
        }
        // Fallback to localhost if script not found (e.g., running inline)
        return 'http://localhost:8000';
    }

    const BASE_URL = getBaseUrl();
    console.log('[Bookmarklet Manager] Using base URL:', BASE_URL);

    // ============================================
    // CONFIGURATION: Add your bookmarklets here
    // ============================================
    const BOOKMARKLETS = [
        {
            name: "Network Logger",
            description: "Log network requests",
            script: '/gmat-hero-network-logger.js'
        },
        {
            name: "Extract HTML",
            description: "Extract page HTML structure",
            script: '/gmat_hero_extract_html_bookmarklet.js'
        },
        {
            name: "GMAT Hero - Quant Auto",
            description: "Auto-scrape GMAT Hero questions",
            script: '/gmat-hero/gmat-hero-quant-auto-scraping.js'
        },
        {
            name: "GMAT Hero - Verbal Auto",
            description: "Auto-scrape GMAT Hero Verbal questions",
            script: '/gmat-hero/gmat-hero-unified-autoscraping.js'
        },
        {
            name: "GMAT Hero - DI Auto",
            description: "Auto-scrape GMAT Hero questions",
            script: '/gmat-hero/gmat-hero-di-autoscraping.js'
        },
        {
            name: "GMAT Hero - DI TPA Auto",
            description: "Auto-scrape Two-Part Analysis questions",
            script: '/gmat-hero/gmat-hero-di-tpa-autoscraping.js'
        },
        {
            name: "GMAT Hero - DI TA Auto",
            description: "Auto-scrape Table Analysis questions",
            script: '/gmat-hero/gmat-hero-di-ta-autoscraping.js'
        },
        {
            name: "GMAT Hero - DI MSR Auto",
            description: "Auto-scrape Multi-Source Reasoning questions",
            script: '/gmat-hero/gmat-hero-di-msr-autoscraping.js'
        },
        {
            name: "Fullscreen Mode",
            description: "Add fullscreen toggle button to GMAT Hero header",
            script: '/gmat-hero/gmat-hero-fullscreen.js'
        },
        {
            name: "GMAT OG - Auto",
            description: "Auto-scrape GMAT Official Practice questions",
            script: '/gmat-og/gmat-og-autoscraping.js'
        },
        {
            name: "GMAT OG - Advanced",
            description: "Auto-scrape GMAT Official Practice questions",
            script: '/gmat-og/gmat-og-advanced-autoscraping.js'
        }
    ];

    // Helper function to load a script
    function loadScript(scriptPath) {
        var s = document.createElement('script');
        s.src = BASE_URL + scriptPath + '?ts=' + (+new Date());
        document.head.appendChild(s);
    }

    // ============================================
    // UI STYLES
    // ============================================
    const styles = `
        .bookmarklet-manager-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
            }
            to { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .bookmarklet-manager-panel {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        }

        .bookmarklet-manager-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        }

        .bookmarklet-manager-title {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: white;
            margin: 0;
        }

        .bookmarklet-manager-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 24px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-weight: 300;
        }

        .bookmarklet-manager-close:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: rotate(90deg);
        }

        .bookmarklet-manager-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 12px;
        }

        .bookmarklet-button {
            background: white;
            border: none;
            border-radius: 12px;
            padding: 16px;
            cursor: pointer;
            text-align: left;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .bookmarklet-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .bookmarklet-button:active {
            transform: translateY(0);
        }

        .bookmarklet-button-name {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            font-weight: 600;
            color: #667eea;
            margin: 0 0 6px 0;
        }

        .bookmarklet-button-description {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            color: #666;
            margin: 0;
            line-height: 1.4;
        }

        .bookmarklet-manager-footer {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 2px solid rgba(255, 255, 255, 0.2);
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
        }

        /* Scrollbar styling */
        .bookmarklet-manager-panel::-webkit-scrollbar {
            width: 8px;
        }

        .bookmarklet-manager-panel::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }

        .bookmarklet-manager-panel::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }

        .bookmarklet-manager-panel::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.4);
        }
    `;

    // ============================================
    // CHECK IF ALREADY OPEN
    // ============================================
    if (document.getElementById('bookmarklet-manager-overlay')) {
        document.getElementById('bookmarklet-manager-overlay').remove();
        return;
    }

    // ============================================
    // CREATE UI
    // ============================================

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'bookmarklet-manager-overlay';
    overlay.className = 'bookmarklet-manager-overlay';

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'bookmarklet-manager-panel';

    // Create header
    const header = document.createElement('div');
    header.className = 'bookmarklet-manager-header';
    header.innerHTML = `
        <h2 class="bookmarklet-manager-title">🔖 Bookmarklet Manager</h2>
        <button class="bookmarklet-manager-close">×</button>
    `;

    // Create grid
    const grid = document.createElement('div');
    grid.className = 'bookmarklet-manager-grid';

    // Create buttons for each bookmarklet
    BOOKMARKLETS.forEach((bookmarklet, index) => {
        const button = document.createElement('button');
        button.className = 'bookmarklet-button';
        button.innerHTML = `
            <h3 class="bookmarklet-button-name">${bookmarklet.name}</h3>
            <p class="bookmarklet-button-description">${bookmarklet.description}</p>
        `;

        button.addEventListener('click', () => {
            try {
                // Close the manager
                overlay.remove();

                // Load the bookmarklet script
                loadScript(bookmarklet.script);
            } catch (error) {
                console.error(`Error executing bookmarklet "${bookmarklet.name}":`, error);
                alert(`Error executing "${bookmarklet.name}": ${error.message}`);
            }
        });

        grid.appendChild(button);
    });

    // Create footer
    const footer = document.createElement('div');
    footer.className = 'bookmarklet-manager-footer';
    footer.textContent = `${BOOKMARKLETS.length} bookmarklets available • Press ESC or click outside to close`;

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(grid);
    panel.appendChild(footer);
    overlay.appendChild(panel);

    // ============================================
    // EVENT LISTENERS
    // ============================================

    // Close button
    header.querySelector('.bookmarklet-manager-close').addEventListener('click', () => {
        overlay.remove();
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // ============================================
    // SHOW THE MANAGER
    // ============================================
    document.body.appendChild(overlay);
})();
