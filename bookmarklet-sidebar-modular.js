(function () {
  'use strict';

  // Prevent multiple injections
  if (document.getElementById('smartlog-split-container')) {
    alert('SmartLog AI Sidebar is already open!');
    return;
  }

  window.__SMARTLOG_INJECTED__ = true;

  // ============================================================================
  // CONFIGURATION & CONSTANTS
  // ============================================================================

  const CONFIG = {
    apiUrl: 'https://gmat-errorlog.vercel.app',
    devUrl: 'http://localhost:5001',
    version: '2.1.0-sidebar-modular'
  };

  const isLocalhost = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1' ||
                     window.location.href.includes('localhost');
  const baseUrl = isLocalhost ? CONFIG.devUrl : CONFIG.apiUrl;

  // Mappings for parsing
  const sectionMappings = {
    'vb': 'verbal',
    'verbal': 'verbal',
    'qt': 'quant',
    'quant': 'quant',
    'quantitative': 'quant',
    'di': 'di',
    'data': 'di',
    'data insights': 'di'
  };

  const allSectionMappings = {
    'v': 'verbal',
    'vb': 'verbal',
    'verbal': 'verbal',
    'q': 'quant',
    'qt': 'quant',
    'quant': 'quant',
    'quantitative': 'quant',
    'd': 'di',
    'di': 'di',
    'data': 'di',
    'data insights': 'di'
  };

  const difficultyMappings = {
    'easy': 'easy',
    'med': 'medium',
    'medium': 'medium',
    'hard': 'hard'
  };

  const allDifficultyMappings = {
    'e': 'easy',
    'easy': 'easy',
    'm': 'medium',
    'med': 'medium',
    'medium': 'medium',
    'h': 'hard',
    'hard': 'hard'
  };

  const sourceMappings = {
    'og': 'OG',
    'official': 'OG',
    'guide': 'OG',
    'gmat': 'GMATClub',
    'club': 'GMATClub',
    'gmatclub': 'GMATClub',
    'ttp': 'TTP',
    'target test prep': 'TTP'
  };

  const urlSourceMappings = [
    { pattern: /gmat-hero-v2\.web\.app/i, source: 'OG' },
    { pattern: /gmatclub\.com\/forum/i, source: 'GMATClub' },
    { pattern: /targettestprep\.com/i, source: 'TTP' }
  ];

  // --- Icons (SVG Strings) ---
  const ICONS = {
    zap: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-600"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l5 5a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-5-5z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    loader: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    brain: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
    gripVertical: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`
  };

  // ============================================================================
  // STATE
  // ============================================================================

  const state = {
    sidebarWidth: 400,
    isCollapsed: false,
    activeTab: 'log',
    isAnalyzing: false,
    apiKey: localStorage.getItem('gemini_api_key') || '',
    logData: {
      url: window.location.href,
      notes: '',
      tags: [],
      source: document.title
    },
    aiReasoning: null,
    // Modular state
    categories: [],
    allTags: [],
    extractQuestionFn: null
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function decodeHtmlEntities(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  }

  function detectSourceFromLink(url) {
    if (!url.trim()) return undefined;
    try {
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//i)) normalizedUrl = 'https://' + normalizedUrl;
      for (const mapping of urlSourceMappings) {
        if (mapping.pattern.test(normalizedUrl)) return mapping.source;
      }
    } catch (error) {
      console.warn('Invalid URL format:', url);
    }
    return undefined;
  }

  function detectQuestionSource(url) {
    if (!url) return null;
    if (url.includes('gmatclub.com')) {
      return 'gmatclub';
    } else if (url.includes('gmat-hero-v2.web.app')) {
      return 'gmathero';
    }
    return null;
  }

  function createBadge(text, variant) {
    const badge = document.createElement('span');
    const styles = {
      green: {
        background: '#dcfce7',
        border: '1px solid #bbf7d0',
        color: '#166534'
      },
      default: {
        background: '#f3f4f6',
        border: '1px solid #d1d5db',
        color: '#374151'
      }
    };
    const style = styles[variant] || styles.default;
    badge.style.cssText = `display:inline-block;padding:2px 8px;font-size:12px;font-weight:500;border-radius:9999px;background:${style.background};border:${style.border};color:${style.color};margin-right:8px;margin-bottom:4px`;
    badge.textContent = text;
    return badge;
  }

  function showStatus(message, type, root) {
    const statusDiv = root.getElementById('gmat-logger-status');
    if (!statusDiv) return;

    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    const styles = {
      success: {
        background: '#dcfce7',
        color: '#166534',
        border: '1px solid #bbf7d0'
      },
      error: {
        background: '#fef2f2',
        color: '#dc2626',
        border: '1px solid #fecaca'
      },
      default: {
        background: '#f3f4f6',
        color: '#374151',
        border: '1px solid #d1d5db'
      }
    };
    const style = styles[type] || styles.default;
    Object.assign(statusDiv.style, style);
  }

  function enrichquestionData(questionData, payload) {
    if (!questionData) return null;

    questionData.question_link = payload.question || questionData.question_link;
    questionData.difficulty = payload.difficulty || questionData.difficulty;
    questionData.source = payload.source || questionData.source;

    if (questionData.content && payload.category) {
      questionData.content.category = payload.category;
    }

    return questionData;
  }

  // ============================================================================
  // PARSING & AUTOCOMPLETE FUNCTIONS
  // ============================================================================

  function parseNotes(notes) {
    const originalNotes = notes;
    const normalizedNotes = notes.toLowerCase().trim();
    const words = normalizedNotes.split(/\s+/);
    let section, category, difficulty, source;
    const usedWords = new Set();

    // Parse section, difficulty, source
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!usedWords.has(i) && sectionMappings[word]) {
        section = sectionMappings[word];
        usedWords.add(i);
        break;
      }
    }
    for (let i = 0; i < words.length; i++) {
      if (usedWords.has(i)) continue;
      const word = words[i];
      if (difficultyMappings[word]) {
        difficulty = difficultyMappings[word];
        usedWords.add(i);
        break;
      }
    }
    for (let i = 0; i < words.length; i++) {
      if (usedWords.has(i)) continue;
      const word = words[i];
      if (sourceMappings[word]) {
        source = sourceMappings[word];
        usedWords.add(i);
        break;
      }
    }

    // Parse category using shortName or full name
    for (const cat of state.categories) {
      const categoryWords = cat.name.toLowerCase().split(' ');

      if (categoryWords.length > 1) {
        for (let i = 0; i <= words.length - categoryWords.length; i++) {
          const wordIndices = Array.from({ length: categoryWords.length }, (_, idx) => i + idx);
          if (wordIndices.some(idx => usedWords.has(idx))) continue;

          const matchesCategory = categoryWords.every((catWord, idx) =>
            words[i + idx] === catWord
          );

          if (matchesCategory) {
            category = cat.name;
            if (!section) {
              section = cat.section;
            }
            wordIndices.forEach(idx => usedWords.add(idx));
            break;
          }
        }
        if (category) break;
      }
    }

    if (!category) {
      for (let i = 0; i < words.length; i++) {
        if (usedWords.has(i)) continue;
        const word = words[i];

        const categoryByShort = state.categories.find(cat =>
          cat.shortName?.toLowerCase() === word
        );

        if (categoryByShort) {
          category = categoryByShort.name;
          if (!section) {
            section = categoryByShort.section;
          }
          usedWords.add(i);
          break;
        }

        const categoryByName = state.categories.find(cat =>
          cat.name.toLowerCase() === word
        );

        if (categoryByName) {
          category = categoryByName.name;
          if (!section) {
            section = categoryByName.section;
          }
          usedWords.add(i);
          break;
        }
      }
    }

    // Extract remaining words as notes
    if (usedWords.size === 0) {
      return { section, category, difficulty, source, extractedNotes: originalNotes || undefined };
    }

    const allParts = originalNotes.split(/(\s+)/);
    const keptParts = [];
    let normalizedWordIndex = 0;

    for (const part of allParts) {
      if (/^\s+$/.test(part)) {
        keptParts.push(part);
      } else {
        if (!usedWords.has(normalizedWordIndex)) {
          keptParts.push(part);
        }
        normalizedWordIndex++;
      }
    }

    let extractedNotes = keptParts.join('');
    extractedNotes = extractedNotes.replace(/^[ \t]+/, '');
    extractedNotes = extractedNotes.replace(/[ \t]+$/, '');

    return { section, category, difficulty, source, extractedNotes: extractedNotes || undefined };
  }

  function parseNotesAndLink(notes, questionLink) {
    const notesResult = parseNotes(notes);
    const linkSource = questionLink ? detectSourceFromLink(questionLink) : undefined;
    const finalSource = linkSource || notesResult.source;

    return {
      ...notesResult,
      source: finalSource,
    };
  }

  function getAutoSuggestions(input, cursorPosition, parsedInfo) {
    const beforeCursor = input.substring(0, cursorPosition).toLowerCase();
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1] || '';
    if (currentWord.length < 1) return [];

    const suggestions = [];
    const startIndex = cursorPosition - currentWord.length;

    const hasSection = parsedInfo?.section;
    const hasDifficulty = parsedInfo?.difficulty;
    const hasSource = parsedInfo?.source;
    const hasCategory = parsedInfo?.category;

    if (!hasSection) {
      Object.entries(allSectionMappings).forEach(([key, value]) => {
        if (key.startsWith(currentWord) && key !== currentWord) {
          let displayName = value === 'di' ? 'DI' : value.charAt(0).toUpperCase() + value.slice(1);
          suggestions.push({ type: 'section', shortName: key, fullName: displayName, startIndex, endIndex: cursorPosition });
        }
      });
    }

    if (!hasDifficulty) {
      Object.entries(allDifficultyMappings).forEach(([key, value]) => {
        if (key.startsWith(currentWord) && key !== currentWord) {
          suggestions.push({ type: 'difficulty', shortName: key, fullName: value.charAt(0).toUpperCase() + value.slice(1), startIndex, endIndex: cursorPosition });
        }
      });
    }

    if (!hasSource) {
      Object.entries(sourceMappings).forEach(([key, value]) => {
        if (key.startsWith(currentWord) && key !== currentWord) {
          suggestions.push({ type: 'source', shortName: key, fullName: value, startIndex, endIndex: cursorPosition });
        }
      });
    }

    if (!hasCategory) {
      state.categories.forEach(category => {
        if (category.shortName && category.shortName.toLowerCase().startsWith(currentWord) && category.shortName.toLowerCase() !== currentWord) {
          suggestions.push({
            type: 'category',
            shortName: category.shortName.toLowerCase(),
            fullName: category.name,
            startIndex,
            endIndex: cursorPosition,
          });
        }

        const categoryNameLower = category.name.toLowerCase();
        const inputFromStart = beforeCursor.trim();
        const lastTwoWords = words.slice(-2).join(' ');
        const lastThreeWords = words.slice(-3).join(' ');

        const possibleMatches = [currentWord, lastTwoWords, lastThreeWords, inputFromStart];

        for (const match of possibleMatches) {
          if (match && match.length >= 1 && categoryNameLower.startsWith(match) && categoryNameLower !== match) {
            const matchStartIndex = cursorPosition - match.length;

            suggestions.push({
              type: 'category',
              shortName: categoryNameLower,
              fullName: category.name,
              startIndex: matchStartIndex,
              endIndex: cursorPosition,
            });
            break;
          }
        }
      });
    }

    return suggestions.sort((a, b) => a.shortName.length - b.shortName.length || a.shortName.localeCompare(b.shortName)).slice(0, 1);
  }

  function applySuggestion(input, suggestion, cursorPosition) {
    const before = input.substring(0, suggestion.startIndex);
    const after = input.substring(suggestion.endIndex);
    const completionText = suggestion.type === 'category' ? suggestion.fullName : suggestion.shortName;
    const newInput = before + completionText + ' ' + after;
    const newCursorPosition = suggestion.startIndex + completionText.length + 1;
    return { newInput, newCursorPosition };
  }

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  async function fetchCategories() {
    try {
      const cachedData = localStorage.getItem('gmatLoggerCategories');
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const oneHour = 60 * 60 * 1000;

        if (Date.now() - timestamp < oneHour) {
          state.categories = Array.isArray(data) ? data : data.categories || [];
          if (state.categories.length > 0) {
            console.log('Using cached categories');
            return;
          }
        }
      }

      console.log('Fetching categories from API');
      const response = await fetch(`${baseUrl}/api/categories`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.categories = Array.isArray(data) ? data : data.categories || [];

      localStorage.setItem('gmatLoggerCategories', JSON.stringify({
        timestamp: Date.now(),
        data: state.categories
      }));

      if (state.categories.length === 0) {
        state.categories = [
          { id: 'fallback-1', name: 'Weaken', section: 'verbal', shortName: null },
          { id: 'fallback-2', name: 'Strengthen', section: 'verbal', shortName: null },
          { id: 'fallback-3', name: 'Assumption', section: 'verbal', shortName: null },
          { id: 'fallback-4', name: 'Word Problems', section: 'quant', shortName: 'wp' }
        ];
      }
    } catch (error) {
      console.warn('Error fetching categories:', error);
      const cachedData = localStorage.getItem('gmatLoggerCategories');
      if (cachedData) {
        try {
          const { data } = JSON.parse(cachedData);
          state.categories = Array.isArray(data) ? data : data.categories || [];
          if (state.categories.length > 0) {
            console.log('Using cached categories despite API error');
            return;
          }
        } catch (parseError) {
          console.warn('Error parsing cached categories:', parseError);
        }
      }

      console.log('Using fallback categories');
      state.categories = [
        { id: 'fallback-1', name: 'Weaken', section: 'verbal', shortName: null },
        { id: 'fallback-2', name: 'Strengthen', section: 'verbal', shortName: null },
        { id: 'fallback-3', name: 'Assumption', section: 'verbal', shortName: null },
        { id: 'fallback-4', name: 'Word Problems', section: 'quant', shortName: 'wp' }
      ];
    }
  }

  async function fetchAllTags() {
    try {
      const cachedData = localStorage.getItem('gmatLoggerTags');
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const oneHour = 60 * 60 * 1000;

        if (Date.now() - timestamp < oneHour) {
          return Array.isArray(data) ? data : [];
        }
      }

      console.log('Fetching tags from API');
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const tags = Array.isArray(data) ? data : data.tags || [];

      localStorage.setItem('gmatLoggerTags', JSON.stringify({
        timestamp: Date.now(),
        data: tags
      }));

      return tags;
    } catch (error) {
      console.warn('Error fetching tags:', error);
      const cachedData = localStorage.getItem('gmatLoggerTags');
      if (cachedData) {
        try {
          const { data } = JSON.parse(cachedData);
          return Array.isArray(data) ? data : [];
        } catch (parseError) {
          console.warn('Error parsing cached tags:', parseError);
        }
      }

      return [];
    }
  }

  // ============================================================================
  // SIDEBAR CREATION & LAYOUT
  // ============================================================================

  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'smartlog-split-container';
  sidebarContainer.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: ${state.sidebarWidth}px !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: white !important;
    box-shadow: -5px 0 20px rgba(0,0,0,0.15) !important;
    display: flex !important;
    flex-direction: row !important;
    transition: transform 0.3s ease-in-out !important;
  `;

  // Resize Handle
  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'smartlog-resize-handle';
  resizeHandle.style.cssText = `
    width: 12px !important;
    height: 100% !important;
    background: transparent !important;
    cursor: col-resize !important;
    position: absolute !important;
    left: -6px !important;
    top: 0 !important;
    z-index: 2147483648 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;
  const handleVisual = document.createElement('div');
  handleVisual.style.cssText = `
    width: 4px !important;
    height: 40px !important;
    background: #e5e7eb !important;
    border-radius: 2px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
  `;
  resizeHandle.appendChild(handleVisual);
  resizeHandle.addEventListener('mouseenter', () => handleVisual.style.background = '#d1d5db');
  resizeHandle.addEventListener('mouseleave', () => handleVisual.style.background = '#e5e7eb');

  // Content Area
  const contentArea = document.createElement('div');
  contentArea.style.cssText = `
    flex: 1 !important;
    height: 100% !important;
    overflow: hidden !important;
    position: relative !important;
    background: white !important;
  `;

  // Expand Button
  const expandButton = document.createElement('button');
  expandButton.id = 'smartlog-expand-button';
  expandButton.style.cssText = `
    position: fixed !important;
    right: 0 !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    background: white !important;
    border: 1px solid #d1d5db !important;
    padding: 8px !important;
    border-radius: 8px 0 0 8px !important;
    box-shadow: -2px 2px 8px rgba(0,0,0,0.1) !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    display: none !important;
  `;
  expandButton.innerHTML = `<div style="color: #eab308;">${ICONS.zap}</div>`;
  expandButton.onclick = () => {
    state.isCollapsed = false;
    updateLayout();
  };

  // Assemble
  sidebarContainer.appendChild(resizeHandle);
  sidebarContainer.appendChild(contentArea);
  document.body.appendChild(sidebarContainer);
  document.body.appendChild(expandButton);

  // --- Adjust Body Margin ---
  const originalBodyTransition = document.body.style.transition;
  document.body.style.transition = 'margin-right 0.3s ease-in-out';

  function updateLayout() {
    if (state.isCollapsed) {
      sidebarContainer.style.transform = 'translateX(100%)';
      document.body.style.marginRight = '0px';
      expandButton.style.display = 'block';
    } else {
      sidebarContainer.style.transform = 'translateX(0)';
      sidebarContainer.style.width = `${state.sidebarWidth}px`;
      document.body.style.marginRight = `${state.sidebarWidth}px`;
      expandButton.style.display = 'none';
    }
  }

  updateLayout();

  // --- Detect Modals and Adjust Z-Index ---
  function detectAndHandleModals() {
    const allElements = document.querySelectorAll('*');
    let maxZIndex = 2147483647;

    allElements.forEach(el => {
      const zIndex = parseInt(window.getComputedStyle(el).zIndex);
      if (!isNaN(zIndex) && zIndex > maxZIndex) {
        maxZIndex = zIndex;
      }
    });

    if (maxZIndex > 2147483647) {
      const newZIndex = maxZIndex + 10;
      sidebarContainer.style.zIndex = newZIndex;
      expandButton.style.zIndex = newZIndex;
      resizeHandle.style.zIndex = newZIndex + 1;
      console.log(`[SmartLog] Detected modal with z-index ${maxZIndex}, adjusted to ${newZIndex}`);
    }
  }

  const modalObserver = new MutationObserver(() => {
    detectAndHandleModals();
  });

  modalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  detectAndHandleModals();
  setInterval(detectAndHandleModals, 1000);

  // --- Resize Logic ---
  let isResizing = false;
  let startX, startWidth;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebarContainer.offsetWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    sidebarContainer.style.transition = 'none';
    document.body.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = startX - e.clientX;
    const newWidth = Math.min(Math.max(startWidth + delta, 300), window.innerWidth * 0.8);
    state.sidebarWidth = newWidth;
    sidebarContainer.style.width = `${newWidth}px`;
    document.body.style.marginRight = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      sidebarContainer.style.transition = 'transform 0.3s ease-in-out';
      document.body.style.transition = 'margin-right 0.3s ease-in-out';
    }
  });

  // ============================================================================
  // SHADOW DOM & UI
  // ============================================================================

  const shadow = contentArea.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
  shadow.appendChild(styleLink);

  const customStyles = document.createElement('style');
  customStyles.textContent = `
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;
  shadow.appendChild(customStyles);

  const container = document.createElement('div');
  container.className = "bg-white h-full flex flex-col text-gray-800 font-sans";
  shadow.appendChild(container);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  function updateParsedPreview(questionLink, notes, root) {
    const parsed = parseNotesAndLink(notes, questionLink);
    const previewDiv = root.getElementById('gmat-parsed-preview');
    const badgesDiv = root.getElementById('gmat-parsed-badges');
    const notesP = root.getElementById('gmat-parsed-notes');

    if (!parsed.source && !parsed.section && !parsed.category && !parsed.difficulty && !parsed.extractedNotes) {
      previewDiv.style.display = 'none';
      return;
    }

    previewDiv.style.display = 'block';
    badgesDiv.innerHTML = '';

    if (parsed.source) {
      const sourceBadge = createBadge(`Source: ${parsed.source}`, 'green');
      if (questionLink.trim()) sourceBadge.innerHTML += ' <span style="margin-left:4px">📎</span>';
      badgesDiv.appendChild(sourceBadge);
    }
    if (parsed.section) {
      const sectionText = parsed.section === 'di' ? 'DI' : parsed.section.charAt(0).toUpperCase() + parsed.section.slice(1);
      badgesDiv.appendChild(createBadge(`Section: ${sectionText}`, 'default'));
    }
    if (parsed.category) badgesDiv.appendChild(createBadge(`Category: ${parsed.category}`, 'default'));
    if (parsed.difficulty) badgesDiv.appendChild(createBadge(`Difficulty: ${parsed.difficulty.charAt(0).toUpperCase() + parsed.difficulty.slice(1)}`, 'default'));

    if (parsed.extractedNotes) {
      notesP.innerHTML = `<strong>Notes:</strong><br><pre style="white-space: pre-wrap; font-family: inherit; margin: 4px 0 0 0; font-size: inherit;">${parsed.extractedNotes}</pre>`;
      notesP.style.display = 'block';
    } else {
      notesP.style.display = 'none';
    }
  }

  async function submitQuestionData(root) {
    const questionLink = root.getElementById('gmat-question-link').value.trim();
    const notes = root.getElementById('gmat-notes').value.trim();
    const submitBtn = root.getElementById('gmat-logger-submit');

    if (!questionLink && !notes) {
      showStatus('Please enter either a question link or notes.', 'error', root);
      return;
    }

    // Get tags from DOM
    const tagsContainer = root.getElementById('gmat-tags-container');
    const tagElements = tagsContainer.querySelectorAll('span');
    const tags = Array.from(tagElements).map(tagEl => {
      let tagText = tagEl.textContent.replace(/\s*×\s*$/, '').trim();
      console.log('Bookmarklet: Extracted tag text:', tagText);
      return tagText;
    }).filter(tag => tag && tag.trim() !== '');

    console.log('Bookmarklet: Final tags to submit:', tags);

    const parsed = parseNotesAndLink(notes, questionLink);
    const payload = {
      question: questionLink || '',
      source: parsed.source || '',
      section: parsed.section || '',
      category: parsed.category || '',
      difficulty: parsed.difficulty || '',
      notes: parsed.extractedNotes || notes || '',
      status: 'Must Review',
      mistakeTypes: tags
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Extracting...';

    try {
      // Extract question JSON if extractor is available
      if (state.extractQuestionFn) {
        console.log('Attempting to extract question from page...');
        const questionData = await state.extractQuestionFn();

        if (questionData) {
          console.log('Question extracted successfully:', questionData);

          // Enrich with bookmarklet data
          const enrichedJson = enrichquestionData(questionData, payload);
          console.log('Enriched question JSON:', enrichedJson);

          // Add to payload
          payload.questionData = enrichedJson;

          submitBtn.textContent = 'Adding...';
        } else {
          console.log('No question extracted (unsupported page or extraction failed)');
          submitBtn.textContent = 'Adding...';
        }
      } else {
        console.log('No extractor available for this page');
        submitBtn.textContent = 'Adding...';
      }

      const response = await fetch(`${baseUrl}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      showStatus('✅ Question added successfully!', 'success', root);
      setTimeout(() => {
        state.isCollapsed = true;
        updateLayout();
      }, 1500);
    } catch (error) {
      console.error('Submission error:', error);
      showStatus(`❌ Error: ${error.message}`, 'error', root);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Quick Add';
    }
  }

  function renderLogTab(parent, root) {
    parent.innerHTML = '';

    const questionLinkGroup = document.createElement('div');
    questionLinkGroup.className = "space-y-2";
    questionLinkGroup.innerHTML = `
      <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.link} Question Link</label>
      <input id="gmat-question-link" type="text" value="${window.location.href}" class="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
    `;
    parent.appendChild(questionLinkGroup);

    const notesGroup = document.createElement('div');
    notesGroup.className = "space-y-2";
    notesGroup.innerHTML = `
      <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.fileText} Smart Notes</label>
      <div class="relative">
        <textarea id="gmat-notes" placeholder="Type: weaken hard - my mistake was..." class="w-full p-3 border border-gray-300 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-gray-700 leading-relaxed"></textarea>
        <div id="gmat-suggestions" style="position:absolute;z-index:10;width:100%;margin-top:1px;background:white;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:none"></div>
      </div>
      <p class="text-xs text-gray-500">Type keywords: <code class="bg-gray-100 px-1.5 py-0.5 rounded">weaken</code>, <code class="bg-gray-100 px-1.5 py-0.5 rounded">hard</code> and press Tab to complete.</p>
    `;
    parent.appendChild(notesGroup);

    const tagsSection = document.createElement('div');
    tagsSection.className = "space-y-2";
    tagsSection.innerHTML = `
      <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.tag} Mistake Tags</label>
      <div id="gmat-tags-container" class="flex flex-wrap gap-2 min-h-[24px]"></div>
      <div id="gmat-tags-section" class="mt-2">
        <div class="flex justify-flex-start mb-1">
          <button type="button" id="gmat-toggle-tags" class="text-blue-600 text-xs hover:underline">See all</button>
        </div>
        <div id="gmat-tags-list" class="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto custom-scrollbar"></div>
        <div id="gmat-tags-expanded" style="display:none" class="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar"></div>
      </div>
    `;
    parent.appendChild(tagsSection);

    const parsedPreview = document.createElement('div');
    parsedPreview.id = 'gmat-parsed-preview';
    parsedPreview.style.cssText = 'background:rgba(156,163,175,0.1);padding:16px;border-radius:8px;display:none';
    parsedPreview.innerHTML = `
      <h4 class="font-medium text-sm text-gray-600 mb-2">Parsed Information:</h4>
      <div id="gmat-parsed-badges" class="flex flex-wrap gap-2"></div>
      <p id="gmat-parsed-notes" style="font-size:12px;color:#6b7280;margin:8px 0 0 0;display:none;max-height:200px;overflow-y:auto" class="custom-scrollbar"></p>
    `;
    parent.appendChild(parsedPreview);

    const statusDiv = document.createElement('div');
    statusDiv.id = 'gmat-logger-status';
    statusDiv.style.cssText = 'margin-top:16px;padding:12px;border-radius:6px;font-size:14px;display:none';
    parent.appendChild(statusDiv);

    setupLogTabEvents(root);
  }

  function setupLogTabEvents(root) {
    const questionLinkInput = root.getElementById('gmat-question-link');
    const notesTextarea = root.getElementById('gmat-notes');
    const tagsContainer = root.getElementById('gmat-tags-container');
    const toggleTagsBtn = root.getElementById('gmat-toggle-tags');
    const tagsList = root.getElementById('gmat-tags-list');
    const tagsExpanded = root.getElementById('gmat-tags-expanded');
    const suggestionsDiv = root.getElementById('gmat-suggestions');

    let currentSuggestions = [];
    let cursorPosition = 0;
    let tags = [];

    function renderTags() {
      tagsContainer.innerHTML = '';
      tags.forEach((tag, index) => {
        const tagElement = document.createElement('span');
        tagElement.style.cssText = 'display:inline-block;padding:2px 8px;font-size:12px;font-weight:500;border-radius:9999px;background:#e5e7eb;border:1px solid #d1d5db;color:#374151;margin-right:4px;margin-bottom:4px;cursor:pointer';
        tagElement.innerHTML = `${tag} <span style="margin-left:4px;cursor:pointer;font-weight:bold">×</span>`;
        tagElement.querySelector('span').addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          tags.splice(index, 1);
          renderTags();
        });
        tagsContainer.appendChild(tagElement);
      });
    }

    function addTag(tag) {
      const trimmedTag = tag.trim();
      if (trimmedTag && !tags.includes(trimmedTag)) {
        tags.push(trimmedTag);
        renderTags();
      }
    }

    function renderTagList(allTags) {
      tagsList.innerHTML = '';
      tagsExpanded.innerHTML = '';

      const visibleTags = allTags.slice(0, 6);

      visibleTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.style.cssText = 'display:inline-block;padding:2px 8px;font-size:12px;font-weight:500;border-radius:9999px;background:#f3f4f6;border:1px solid #d1d5db;color:#374151;margin-right:4px;margin-bottom:4px;cursor:pointer';
        tagElement.textContent = tag.name || tag;
        tagElement.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          addTag(tag.name || tag);
        });
        tagsList.appendChild(tagElement);
      });

      allTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.style.cssText = 'display:inline-block;padding:2px 8px;font-size:12px;font-weight:500;border-radius:9999px;background:#f3f4f6;border:1px solid #d1d5db;color:#374151;margin-right:4px;margin-bottom:4px;cursor:pointer';
        tagElement.textContent = tag.name || tag;
        tagElement.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          addTag(tag.name || tag);
        });
        tagsExpanded.appendChild(tagElement);
      });
    }

    let tagsExpandedState = false;
    toggleTagsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      tagsExpandedState = !tagsExpandedState;
      if (tagsExpandedState) {
        tagsList.style.display = 'none';
        tagsExpanded.style.display = 'flex';
        toggleTagsBtn.innerHTML = 'See less';
      } else {
        tagsList.style.display = 'flex';
        tagsExpanded.style.display = 'none';
        toggleTagsBtn.innerHTML = 'See all';
      }
    });

    function updateSuggestions() {
      const input = notesTextarea.value;
      const parsed = parseNotesAndLink(input, questionLinkInput.value);
      const suggestions = getAutoSuggestions(input, cursorPosition, parsed);
      currentSuggestions = suggestions;

      if (suggestions.length > 0) {
        suggestionsDiv.innerHTML = suggestions.map(suggestion => `<button type="button" class="suggestion-item" style="width:100%;padding:12px 16px;text-align:left;background:rgba(156,163,175,0.1);border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:14px"><span style="font-weight:500">${suggestion.fullName}</span><span style="color:#6b7280;font-size:12px">Tab</span></button>`).join('');
        suggestionsDiv.style.display = 'block';
        suggestionsDiv.querySelectorAll('.suggestion-item').forEach((item, index) => {
          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            applySuggestionToTextarea(index);
          });
        });
      } else {
        suggestionsDiv.style.display = 'none';
      }
      updateParsedPreview(questionLinkInput.value, input, root);
    }

    function applySuggestionToTextarea(suggestionIndex) {
      if (suggestionIndex >= 0 && suggestionIndex < currentSuggestions.length) {
        const suggestion = currentSuggestions[suggestionIndex];
        const result = applySuggestion(notesTextarea.value, suggestion, cursorPosition);
        notesTextarea.value = result.newInput;
        cursorPosition = result.newCursorPosition;
        notesTextarea.setSelectionRange(cursorPosition, cursorPosition);
        notesTextarea.focus();
        setTimeout(() => updateSuggestions(), 0);
      }
    }

    notesTextarea.addEventListener('input', (e) => {
      cursorPosition = e.target.selectionStart;
      updateSuggestions();
    });
    notesTextarea.addEventListener('keyup', (e) => {
      cursorPosition = e.target.selectionStart;
    });
    notesTextarea.addEventListener('click', (e) => {
      cursorPosition = e.target.selectionStart;
      updateSuggestions();
    });
    notesTextarea.addEventListener('keydown', (e) => {
      cursorPosition = e.target.selectionStart;
      if (currentSuggestions.length > 0) {
        switch (e.key) {
          case 'Tab':
          case 'Enter':
            e.preventDefault();
            applySuggestionToTextarea(0);
            break;
          case 'Escape':
            suggestionsDiv.style.display = 'none';
            break;
        }
      }
    });
    notesTextarea.addEventListener('blur', () => {
      setTimeout(() => suggestionsDiv.style.display = 'none', 150);
    });
    questionLinkInput.addEventListener('input', () => updateParsedPreview(questionLinkInput.value, notesTextarea.value, root));

    fetchAllTags().then(fetchedTags => {
      state.allTags = fetchedTags;
      renderTagList(state.allTags);
    });

    updateParsedPreview(questionLinkInput.value, notesTextarea.value, root);
  }

  function renderSettings(parent) {
    const div = document.createElement('div');
    div.className = "space-y-4";
    div.innerHTML = `
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">Gemini API Key</label>
        <input type="password" id="input-api-key" value="${state.apiKey}" class="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Enter your API Key">
        <p class="text-xs text-gray-500">Key is stored locally in your browser.</p>
      </div>
      <button id="btn-save-key" class="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700">Save Key</button>
    `;
    parent.appendChild(div);
  }

  function renderAiTab(parent) {
    const aiContainer = document.createElement('div');
    aiContainer.className = "space-y-6 fade-in";
    if (state.isAnalyzing) {
      aiContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-gray-500">
          <div class="w-8 h-8 mb-4 text-purple-500">${ICONS.loader}</div>
          <p class="text-sm">Reading page content...</p>
        </div>`;
    } else if (state.aiReasoning) {
      aiContainer.innerHTML = `
        <div class="space-y-4">
          <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
            <h3 class="font-bold text-purple-900 flex items-center gap-2 mb-2">${ICONS.brain} AI Reasoning</h3>
            <p class="text-sm text-purple-800 leading-relaxed whitespace-pre-line">${state.aiReasoning}</p>
          </div>
          <button id="btn-review-log" class="w-full py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition text-left flex justify-between items-center group">
            <span>Review captured data in Log</span><span class="text-gray-400 group-hover:text-gray-600">→</span>
          </button>
        </div>`;
    } else {
      aiContainer.innerHTML = `
        <div class="text-center py-12">
          <div class="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">${ICONS.sparkles}</div>
          <h3 class="text-gray-900 font-medium mb-2">No Analysis Yet</h3>
          <button id="btn-run-analysis" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 shadow-md shadow-purple-100 transition">Run AI Analysis</button>
        </div>`;
    }
    parent.appendChild(aiContainer);
  }

  function render() {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = "p-4 border-b border-gray-200 flex justify-between items-center bg-white";
    header.innerHTML = `
      <div class="flex items-center space-x-2 text-gray-800">
        <div class="bg-yellow-100 p-1.5 rounded-md">${ICONS.zap}</div>
        <h2 class="font-bold text-lg">Quick Log</h2>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-settings" class="text-gray-400 hover:text-gray-600 transition p-1" title="Settings">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button id="btn-close" class="text-gray-400 hover:text-gray-600 transition p-1" title="Close Sidebar">
          ${ICONS.x}
        </button>
      </div>
    `;
    container.appendChild(header);

    if (state.activeTab !== 'settings') {
      const tabs = document.createElement('div');
      tabs.className = "flex border-b border-gray-200";
      tabs.innerHTML = `
        <button id="tab-log" class="flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${state.activeTab === 'log' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
          Manual Log
        </button>
        <button id="tab-ai" class="flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex justify-center items-center gap-2 ${state.activeTab === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
          ${ICONS.sparkles}
          AI Assistant
        </button>
      `;
      container.appendChild(tabs);
    } else {
      const settingsHeader = document.createElement('div');
      settingsHeader.className = "bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-600 flex items-center gap-2";
      settingsHeader.innerHTML = `<button id="back-from-settings" class="hover:text-gray-900">← Back</button><span>Settings</span>`;
      container.appendChild(settingsHeader);
    }

    const content = document.createElement('div');
    content.className = "flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar";
    if (state.activeTab === 'settings') renderSettings(content);
    else if (state.activeTab === 'log') renderLogTab(content, shadow);
    else renderAiTab(content);
    container.appendChild(content);

    if (state.activeTab !== 'settings') {
      const footer = document.createElement('div');
      footer.className = "p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3";
      footer.innerHTML = `
        <button id="btn-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-300 rounded-lg transition">Cancel</button>
        <button id="btn-save" class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition" ${state.activeTab === 'log' ? 'id="gmat-logger-submit"' : ''}>Quick Add</button>
      `;
      container.appendChild(footer);
    }

    attachEvents(shadow);
  }

  function attachEvents(root) {
    root.getElementById('btn-close')?.addEventListener('click', () => {
      state.isCollapsed = true;
      updateLayout();
    });
    root.getElementById('btn-settings')?.addEventListener('click', () => { state.activeTab = 'settings'; render(); });
    root.getElementById('tab-log')?.addEventListener('click', () => { state.activeTab = 'log'; render(); });
    root.getElementById('tab-ai')?.addEventListener('click', () => { state.activeTab = 'ai'; render(); });
    root.getElementById('back-from-settings')?.addEventListener('click', () => { state.activeTab = 'log'; render(); });
    root.getElementById('btn-save-key')?.addEventListener('click', () => {
      state.apiKey = root.getElementById('input-api-key').value;
      localStorage.setItem('gemini_api_key', state.apiKey);
      alert('API Key saved!');
      state.activeTab = 'log';
      render();
    });
    root.getElementById('btn-run-analysis')?.addEventListener('click', handleAnalysis);
    root.getElementById('btn-review-log')?.addEventListener('click', () => { state.activeTab = 'log'; render(); });
    root.getElementById('btn-cancel')?.addEventListener('click', () => { state.isCollapsed = true; updateLayout(); });

    // Manual Log submit button
    if (state.activeTab === 'log') {
      root.getElementById('gmat-logger-submit')?.addEventListener('click', (e) => {
        e.preventDefault();
        submitQuestionData(root);
      });
    }
  }

  async function handleAnalysis() {
    if (!state.apiKey) {
      alert('Please set your Gemini API Key in Settings first.');
      state.activeTab = 'settings';
      render();
      return;
    }
    state.isAnalyzing = true;
    state.activeTab = 'ai';
    render();
    try {
      const pageText = document.body.innerText.substring(0, 10000);
      const analysis = await analyzeContent(pageText);
      state.aiReasoning = analysis.reasoning;
      state.logData.notes = state.logData.notes ? `${state.logData.notes}\n\n[AI Summary]: ${analysis.summary}` : `[AI Summary]: ${analysis.summary}`;
      state.logData.tags = [...new Set([...state.logData.tags, ...(analysis.suggestedTags || [])])];
      state.logData.source = analysis.detectedSource || state.logData.source;
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Check console.');
    } finally {
      state.isAnalyzing = false;
      render();
    }
  }

  async function analyzeContent(text) {
    const prompt = `Analyze this test prep question:\n"""\n${text}\n"""\nReturn JSON: { summary, reasoning, suggestedTags[], detectedSource, difficulty }`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${state.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    if (!response.ok) throw new Error(response.statusText);
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  }

  // --- Keyboard Shortcut: Ctrl+L (Cmd+L on Mac) ---
  document.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isLKey = e.key === 'l' || e.key === 'L';

    if (isCtrlOrCmd && isLKey) {
      e.preventDefault();
      state.isCollapsed = !state.isCollapsed;
      updateLayout();
      console.log(`[SmartLog] Sidebar ${state.isCollapsed ? 'collapsed' : 'expanded'} via keyboard shortcut`);
    }
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  (async function init() {
    await fetchCategories();

    // Detect and load extractor if on supported page
    const currentUrl = window.location.href;
    const source = detectQuestionSource(currentUrl);

    if (source === 'gmatclub') {
      console.log('GMATClub page detected - extractor would be loaded here');
      // In a real implementation, you would dynamically load the extractor
      // For this single-file version, extractors would need to be inlined
    } else if (source === 'gmathero') {
      console.log('GMAT Hero page detected - extractor would be loaded here');
      // In a real implementation, you would dynamically load the extractor
    }

    render();
  })();

})();
