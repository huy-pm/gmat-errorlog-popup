/**
 * GMAT Error Log Bookmarklet - GitHub Hosted Version
 * Usage: javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/huy-pm/gmat-errorlog@main/gmat-logger-bookmarklet.js';document.head.appendChild(s);})();
 */
(function() {
  'use strict';
  
  const CONFIG = {
    apiUrl: 'https://gmat-errorlog.vercel.app',
    devUrl: 'http://localhost:5001',
    version: '1.3.0' // Updated version to include status field support
  };
  
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.href.includes('localhost');
  const baseUrl = isLocalhost ? CONFIG.devUrl : CONFIG.apiUrl;
  
  let categories = [];
  
  // Mappings for parsing
  const sectionMappings = { 'vb': 'verbal', 'verbal': 'verbal', 'qt': 'quant', 'quant': 'quant', 'quantitative': 'quant', 'di': 'di', 'data': 'di', 'data insights': 'di' };
  const allSectionMappings = { 'v': 'verbal', 'vb': 'verbal', 'verbal': 'verbal', 'q': 'quant', 'qt': 'quant', 'quant': 'quant', 'quantitative': 'quant', 'd': 'di', 'di': 'di', 'data': 'di', 'data insights': 'di' };
  const difficultyMappings = { 'easy': 'easy', 'med': 'medium', 'medium': 'medium', 'hard': 'hard' };
  const allDifficultyMappings = { 'e': 'easy', 'easy': 'easy', 'm': 'medium', 'med': 'medium', 'medium': 'medium', 'h': 'hard', 'hard': 'hard' };
  const sourceMappings = { 'og': 'OG', 'official': 'OG', 'guide': 'OG', 'gmat': 'GMATClub', 'club': 'GMATClub', 'gmatclub': 'GMATClub', 'ttp': 'TTP', 'target test prep': 'TTP' };
  const urlSourceMappings = [
    { pattern: /gmat-hero-v2\.web\.app/i, source: 'OG' },
    { pattern: /gmatclub\.com\/forum/i, source: 'GMATClub' },
    { pattern: /targettestprep\.com/i, source: 'TTP' }
  ];
  
  function detectSourceFromLink(url) {
    if (!url.trim()) return undefined;
    try {
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//i)) normalizedUrl = 'https://' + normalizedUrl;
      for (const mapping of urlSourceMappings) {
        if (mapping.pattern.test(normalizedUrl)) return mapping.source;
      }
    } catch (error) { console.warn('Invalid URL format:', url); }
    return undefined;
  }
  
  function parseNotes(notes) {
    const originalNotes = notes;
    const normalizedNotes = notes.toLowerCase().trim();
    const words = normalizedNotes.split(/\s+/);
    let section, category, difficulty, source;
    const usedWords = new Set();

    // Parse section, difficulty, source
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!usedWords.has(i) && sectionMappings[word]) { section = sectionMappings[word]; usedWords.add(i); break; }
    }
    for (let i = 0; i < words.length; i++) {
      if (usedWords.has(i)) continue;
      const word = words[i];
      if (difficultyMappings[word]) { difficulty = difficultyMappings[word]; usedWords.add(i); break; }
    }
    for (let i = 0; i < words.length; i++) {
      if (usedWords.has(i)) continue;
      const word = words[i];
      if (sourceMappings[word]) { source = sourceMappings[word]; usedWords.add(i); break; }
    }

    // Parse category using shortName or full name
    // First try to match multi-word category names
    for (const cat of categories) {
      const categoryWords = cat.name.toLowerCase().split(' ');
      
      // For multi-word categories, check if consecutive words match
      if (categoryWords.length > 1) {
        for (let i = 0; i <= words.length - categoryWords.length; i++) {
          // Skip if any of these word positions are already used
          const wordIndices = Array.from({length: categoryWords.length}, (_, idx) => i + idx);
          if (wordIndices.some(idx => usedWords.has(idx))) continue;
          
          // Check if consecutive words match the category name
          const matchesCategory = categoryWords.every((catWord, idx) => 
            words[i + idx] === catWord
          );
          
          if (matchesCategory) {
            category = cat.name;
            // Auto-detect section from category if section is not already set
            if (!section) {
              section = cat.section;
            }
            // Mark all matched words as used
            wordIndices.forEach(idx => usedWords.add(idx));
            break;
          }
        }
        if (category) break;
      }
    }
    
    // If no multi-word category was found, try single-word matches
    if (!category) {
      for (let i = 0; i < words.length; i++) {
        if (usedWords.has(i)) continue;
        const word = words[i];
        
        // Try to match by shortName first (exact match)
        const categoryByShort = categories.find(cat => 
          cat.shortName?.toLowerCase() === word
        );
        
        if (categoryByShort) {
          category = categoryByShort.name;
          // Auto-detect section from category if section is not already set
          if (!section) {
            section = categoryByShort.section;
          }
          usedWords.add(i);
          break;
        }
        
        // Try to match by single-word category name (exact match only)
        const categoryByName = categories.find(cat => 
          cat.name.toLowerCase() === word
        );
        
        if (categoryByName) {
          category = categoryByName.name;
          // Auto-detect section from category if section is not already set
          if (!section) {
            section = categoryByName.section;
          }
          usedWords.add(i);
          break;
        }
      }
    }

    // Extract remaining words as notes while preserving original casing and line breaks
    if (usedWords.size === 0) {
      // No words were used for metadata, return all original notes
      return { section, category, difficulty, source, extractedNotes: originalNotes || undefined };
    }

    // Create a simpler approach that preserves the original text structure
    // Split the original text into all parts (words and whitespace)
    const allParts = originalNotes.split(/(\s+)/);
    const keptParts = [];
    
    // Track which normalized words we've processed
    let normalizedWordIndex = 0;
    
    for (const part of allParts) {
      if (/^\s+$/.test(part)) {
        // This is whitespace (including newlines), keep it
        keptParts.push(part);
      } else {
        // This is a word, check if it should be kept
        if (!usedWords.has(normalizedWordIndex)) {
          keptParts.push(part);
        }
        normalizedWordIndex++;
      }
    }
    
    // Join all parts and clean up
    let extractedNotes = keptParts.join('');
    
    // Clean up leading/trailing whitespace while preserving line breaks
    extractedNotes = extractedNotes.replace(/^[ \t]+/, ''); // Remove leading spaces/tabs only
    extractedNotes = extractedNotes.replace(/[ \t]+$/, ''); // Remove trailing spaces/tabs only

    return { section, category, difficulty, source, extractedNotes: extractedNotes || undefined };
  }
  
    // Parse notes and question link to extract complete metadata
    function parseNotesAndLink(notes, questionLink) {
      // First parse the notes
      const notesResult = parseNotes(notes);
      
      // Then try to detect source from link
      const linkSource = questionLink ? detectSourceFromLink(questionLink) : undefined;
      
      // Link-detected source takes precedence over notes-detected source
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

    // Check what's already been detected
    const hasSection = parsedInfo?.section;
    const hasDifficulty = parsedInfo?.difficulty;
    const hasSource = parsedInfo?.source;
    const hasCategory = parsedInfo?.category;

    // Section suggestions (only if not already detected)
    if (!hasSection) {
      Object.entries(allSectionMappings).forEach(([key, value]) => {
        if (key.startsWith(currentWord) && key !== currentWord) {
          let displayName = value === 'di' ? 'DI' : value.charAt(0).toUpperCase() + value.slice(1);
          suggestions.push({ type: 'section', shortName: key, fullName: displayName, startIndex, endIndex: cursorPosition });
        }
      });
    }

    // Difficulty suggestions (only if not already detected)
    if (!hasDifficulty) {
      Object.entries(allDifficultyMappings).forEach(([key, value]) => {
        if (key.startsWith(currentWord) && key !== currentWord) {
          suggestions.push({ type: 'difficulty', shortName: key, fullName: value.charAt(0).toUpperCase() + value.slice(1), startIndex, endIndex: cursorPosition });
        }
      });
    }

    // Source suggestions (only if not already detected)
    if (!hasSource) {
      Object.entries(sourceMappings).forEach(([key, value]) => {
        if (key.startsWith(currentWord) && key !== currentWord) {
          suggestions.push({ type: 'source', shortName: key, fullName: value, startIndex, endIndex: cursorPosition });
        }
      });
    }

    // Category suggestions - enhanced to handle multi-word matching (only if not already detected)
    if (!hasCategory) {
      categories.forEach(category => {
        // Match by shortName
        if (category.shortName && category.shortName.toLowerCase().startsWith(currentWord) && category.shortName.toLowerCase() !== currentWord) {
          suggestions.push({
            type: 'category',
            shortName: category.shortName.toLowerCase(),
            fullName: category.name,
            startIndex,
            endIndex: cursorPosition,
          });
        }
        
        // Match by category name - handle both single words and multi-word phrases
        const categoryNameLower = category.name.toLowerCase();
        
        // Check if the current input (from start or last few words) matches the beginning of category name
        const inputFromStart = beforeCursor.trim();
        const lastTwoWords = words.slice(-2).join(' ');
        const lastThreeWords = words.slice(-3).join(' ');
        
        // Try to match with different word combinations
        const possibleMatches = [currentWord, lastTwoWords, lastThreeWords, inputFromStart];
        
        for (const match of possibleMatches) {
          if (match && match.length >= 1 && categoryNameLower.startsWith(match) && categoryNameLower !== match) {
            // Calculate the correct start index based on the matched phrase
            const matchStartIndex = cursorPosition - match.length;
            
            suggestions.push({
              type: 'category',
              shortName: categoryNameLower,
              fullName: category.name,
              startIndex: matchStartIndex,
              endIndex: cursorPosition,
            });
            break; // Only add one suggestion per category
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
  
  async function fetchCategories() {
    try {
      // Try to get categories from localStorage first (cache for 1 hour)
      const cachedData = localStorage.getItem('gmatLoggerCategories');
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        
        // If cached data is less than 1 hour old, use it
        if (Date.now() - timestamp < oneHour) {
          categories = Array.isArray(data) ? data : data.categories || [];
          if (categories.length > 0) {
            console.log('Using cached categories');
            return; // Use cached categories
          }
        }
      }
      
      // Fetch from API if no valid cache
      console.log('Fetching categories from API');
      const response = await fetch(`${baseUrl}/api/categories`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      categories = Array.isArray(data) ? data : data.categories || [];
      
      // Cache the fetched categories with current timestamp
      localStorage.setItem('gmatLoggerCategories', JSON.stringify({
        timestamp: Date.now(),
        data: categories
      }));
      
      if (categories.length === 0) {
        categories = [
          { id: 'fallback-1', name: 'Weaken', section: 'verbal', shortName: null },
          { id: 'fallback-2', name: 'Strengthen', section: 'verbal', shortName: null },
          { id: 'fallback-3', name: 'Assumption', section: 'verbal', shortName: null },
          { id: 'fallback-4', name: 'Word Problems', section: 'quant', shortName: 'wp' }
        ];
      }
    } catch (error) {
      console.warn('Error fetching categories:', error);
      // Try to use cached categories even if API fails
      const cachedData = localStorage.getItem('gmatLoggerCategories');
      if (cachedData) {
        try {
          const { data } = JSON.parse(cachedData);
          categories = Array.isArray(data) ? data : data.categories || [];
          if (categories.length > 0) {
            console.log('Using cached categories despite API error');
            return; // Use cached categories despite API error
          }
        } catch (parseError) {
          console.warn('Error parsing cached categories:', parseError);
          // Ignore parse errors and fall back to hardcoded categories
        }
      }
      
      // Fallback to hardcoded categories if everything else fails
      console.log('Using fallback categories');
      categories = [
        { id: 'fallback-1', name: 'Weaken', section: 'verbal', shortName: null },
        { id: 'fallback-2', name: 'Strengthen', section: 'verbal', shortName: null },
        { id: 'fallback-3', name: 'Assumption', section: 'verbal', shortName: null },
        { id: 'fallback-4', name: 'Word Problems', section: 'quant', shortName: 'wp' }
      ];
    }
  }
  
  async function createModal() {
    await fetchCategories();
    const existingModal = document.getElementById('gmat-logger-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'gmat-logger-modal';
    modal.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><div style="background:white;border-radius:12px;padding:24px;width:90%;max-width:500px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="margin:0;font-size:20px;font-weight:600;color:#1f2937">⚡ Quick Log</h2><button id="gmat-logger-close" style="background:none;border:none;font-size:24px;cursor:pointer;padding:4px;color:#6b7280">×</button></div><form id="gmat-logger-form"><div style="margin-bottom:16px"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px">Question Link</label><input id="gmat-question-link" type="url" placeholder="https://gmatclub.com/forum/..." style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box"/></div><div style="margin-bottom:16px"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px">Smart Notes</label><div style="position:relative"><textarea id="gmat-notes" placeholder="Type: weaken hard - my mistake was..." style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;min-height:80px;font-family:inherit;box-sizing:border-box"></textarea><div id="gmat-suggestions" style="position:absolute;z-index:10;width:100%;margin-top:1px;background:white;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:none"></div></div><p style="font-size:12px;color:#6b7280;margin-top:4px;margin-bottom:0">Type keywords: <code style="background:#f3f4f6;padding:1px 4px;border-radius:3px">weaken</code>, <code style="background:#f3f4f6;padding:1px 4px;border-radius:3px">hard</code> and press Tab to complete.</p></div><div id="gmat-parsed-preview" style="background:rgba(156,163,175,0.1);padding:16px;border-radius:8px;margin-bottom:16px;display:none"><h4 style="font-weight:500;font-size:14px;color:#6b7280;margin:0 0 8px 0">Parsed Information:</h4><div id="gmat-parsed-badges" style="display:flex;flex-wrap:wrap;gap:8px"></div><p id="gmat-parsed-notes" style="font-size:12px;color:#6b7280;margin:8px 0 0 0;display:none"></p></div><div style="display:flex;gap:12px;justify-content:flex-end"><button type="button" id="gmat-logger-cancel" style="padding:8px 16px;border:1px solid #d1d5db;background:white;color:#374151;border-radius:6px;font-size:14px;cursor:pointer">Cancel</button><button type="submit" id="gmat-logger-submit" style="padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:500">Quick Add</button></div></form><div id="gmat-logger-status" style="margin-top:16px;padding:12px;border-radius:6px;font-size:14px;display:none"></div></div></div>`;
    
    document.body.appendChild(modal);
    document.getElementById('gmat-question-link').value = window.location.href;
    setupEventListeners();
  }
  
  function setupEventListeners() {
    const modal = document.getElementById('gmat-logger-modal');
    const form = document.getElementById('gmat-logger-form');
    const closeBtn = document.getElementById('gmat-logger-close');
    const cancelBtn = document.getElementById('gmat-logger-cancel');
    const questionLinkInput = document.getElementById('gmat-question-link');
    const notesTextarea = document.getElementById('gmat-notes');
    const suggestionsDiv = document.getElementById('gmat-suggestions');
    
    let currentSuggestions = [];
    let cursorPosition = 0;
    
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    function updateSuggestions() {
      const input = notesTextarea.value;
      const parsed = parseNotesAndLink(input, questionLinkInput.value);
      const suggestions = getAutoSuggestions(input, cursorPosition, parsed);
      currentSuggestions = suggestions;
      
      if (suggestions.length > 0) {
        suggestionsDiv.innerHTML = suggestions.map(suggestion => `<button type="button" class="suggestion-item" style="width:100%;padding:12px 16px;text-align:left;background:rgba(156,163,175,0.1);border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:14px"><span style="font-weight:500">${suggestion.fullName}</span><span style="color:#6b7280;font-size:12px">Tab</span></button>`).join('');
        suggestionsDiv.style.display = 'block';
        suggestionsDiv.querySelectorAll('.suggestion-item').forEach((item, index) => {
          item.addEventListener('mousedown', (e) => { e.preventDefault(); applySuggestionToTextarea(index); });
        });
      } else {
        suggestionsDiv.style.display = 'none';
      }
      updateParsedPreview(questionLinkInput.value, input);
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
    
    notesTextarea.addEventListener('input', (e) => { cursorPosition = e.target.selectionStart; updateSuggestions(); });
    notesTextarea.addEventListener('keyup', (e) => { cursorPosition = e.target.selectionStart; });
    notesTextarea.addEventListener('click', (e) => { cursorPosition = e.target.selectionStart; updateSuggestions(); });
    notesTextarea.addEventListener('keydown', (e) => {
      cursorPosition = e.target.selectionStart;
      if (currentSuggestions.length > 0) {
        switch (e.key) {
          case 'Tab': case 'Enter': e.preventDefault(); applySuggestionToTextarea(0); break;
          case 'Escape': suggestionsDiv.style.display = 'none'; break;
        }
      }
    });
    notesTextarea.addEventListener('blur', () => { setTimeout(() => suggestionsDiv.style.display = 'none', 150); });
    questionLinkInput.addEventListener('input', () => updateParsedPreview(questionLinkInput.value, notesTextarea.value));
    form.addEventListener('submit', async (e) => { e.preventDefault(); await submitQuestionData(); });
    updateParsedPreview(questionLinkInput.value, notesTextarea.value);
  }
  
  function updateParsedPreview(questionLink, notes) {
    const parsed = parseNotesAndLink(notes, questionLink);
    const previewDiv = document.getElementById('gmat-parsed-preview');
    const badgesDiv = document.getElementById('gmat-parsed-badges');
    const notesP = document.getElementById('gmat-parsed-notes');
    
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
      notesP.innerHTML = `<strong>Notes:</strong> ${parsed.extractedNotes}`;
      notesP.style.display = 'block';
    } else {
      notesP.style.display = 'none';
    }
  }
  
  function createBadge(text, variant) {
    const badge = document.createElement('span');
    const styles = { green: { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534' }, default: { background: '#f3f4f6', border: '1px solid #d1d5db', color: '#374151' } };
    const style = styles[variant] || styles.default;
    badge.style.cssText = `display:inline-block;padding:2px 8px;font-size:12px;font-weight:500;border-radius:9999px;background:${style.background};border:${style.border};color:${style.color};margin-right:8px;margin-bottom:4px`;
    badge.textContent = text;
    return badge;
  }
  
  async function submitQuestionData() {
    const questionLink = document.getElementById('gmat-question-link').value.trim();
    const notes = document.getElementById('gmat-notes').value.trim();
    const submitBtn = document.getElementById('gmat-logger-submit');
    
    if (!questionLink && !notes) { showStatus('Please enter either a question link or notes.', 'error'); return; }
    
    const parsed = parseNotesAndLink(notes, questionLink);
    const payload = {
      question: questionLink || '',
      source: parsed.source || '',
      section: parsed.section || '',
      category: parsed.category || '',
      difficulty: parsed.difficulty || '',
      notes: parsed.extractedNotes || notes || '',
      status: 'Must Review'
    };
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    try {
      const response = await fetch(`${baseUrl}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      showStatus('✅ Question added successfully!', 'success');
      setTimeout(() => document.getElementById('gmat-logger-modal').remove(), 1500);
    } catch (error) {
      showStatus(`❌ Error: ${error.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Quick Add';
    }
  }
  
  function showStatus(message, type) {
    const statusDiv = document.getElementById('gmat-logger-status');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    const styles = { success: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }, error: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }, default: { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' } };
    const style = styles[type] || styles.default;
    Object.assign(statusDiv.style, style);
  }

  console.log('⚡ GMAT Quick Log Bookmarklet v' + CONFIG.version);
  createModal();
})();
