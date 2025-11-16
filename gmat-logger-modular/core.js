/**
 * GMAT Logger Modular - Core Module
 * UI creation, event handling, and API communication
 */

import {
  CONFIG,
  baseUrl,
  sectionMappings,
  allSectionMappings,
  difficultyMappings,
  allDifficultyMappings,
  sourceMappings,
  detectSourceFromLink,
  detectQuestionSource,
  createBadge,
  showStatus,
  enrichquestionData
} from './utils.js';

// State
let categories = [];
let extractQuestionFn = null; // Will be set by loader

/**
 * Set the question extractor function
 * Called by loader after loading the appropriate extractor
 */
export function setQuestionExtractor(extractorFn) {
  extractQuestionFn = extractorFn;
}

/**
 * Parse notes to extract metadata
 */
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
  for (const cat of categories) {
    const categoryWords = cat.name.toLowerCase().split(' ');

    if (categoryWords.length > 1) {
      for (let i = 0; i <= words.length - categoryWords.length; i++) {
        const wordIndices = Array.from({length: categoryWords.length}, (_, idx) => i + idx);
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

      const categoryByShort = categories.find(cat =>
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

      const categoryByName = categories.find(cat =>
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

/**
 * Parse notes and question link to extract complete metadata
 */
function parseNotesAndLink(notes, questionLink) {
  const notesResult = parseNotes(notes);
  const linkSource = questionLink ? detectSourceFromLink(questionLink) : undefined;
  const finalSource = linkSource || notesResult.source;

  return {
    ...notesResult,
    source: finalSource,
  };
}

/**
 * Get autocomplete suggestions
 */
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
    categories.forEach(category => {
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

/**
 * Apply suggestion to input
 */
function applySuggestion(input, suggestion, cursorPosition) {
  const before = input.substring(0, suggestion.startIndex);
  const after = input.substring(suggestion.endIndex);
  const completionText = suggestion.type === 'category' ? suggestion.fullName : suggestion.shortName;
  const newInput = before + completionText + ' ' + after;
  const newCursorPosition = suggestion.startIndex + completionText.length + 1;
  return { newInput, newCursorPosition };
}

/**
 * Fetch categories from API
 */
async function fetchCategories() {
  try {
    const cachedData = localStorage.getItem('gmatLoggerCategories');
    if (cachedData) {
      const { timestamp, data } = JSON.parse(cachedData);
      const oneHour = 60 * 60 * 1000;

      if (Date.now() - timestamp < oneHour) {
        categories = Array.isArray(data) ? data : data.categories || [];
        if (categories.length > 0) {
          console.log('Using cached categories');
          return;
        }
      }
    }

    console.log('Fetching categories from API');
    const response = await fetch(`${baseUrl}/api/categories`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    categories = Array.isArray(data) ? data : data.categories || [];

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
    const cachedData = localStorage.getItem('gmatLoggerCategories');
    if (cachedData) {
      try {
        const { data } = JSON.parse(cachedData);
        categories = Array.isArray(data) ? data : data.categories || [];
        if (categories.length > 0) {
          console.log('Using cached categories despite API error');
          return;
        }
      } catch (parseError) {
        console.warn('Error parsing cached categories:', parseError);
      }
    }

    console.log('Using fallback categories');
    categories = [
      { id: 'fallback-1', name: 'Weaken', section: 'verbal', shortName: null },
      { id: 'fallback-2', name: 'Strengthen', section: 'verbal', shortName: null },
      { id: 'fallback-3', name: 'Assumption', section: 'verbal', shortName: null },
      { id: 'fallback-4', name: 'Word Problems', section: 'quant', shortName: 'wp' }
    ];
  }
}

/**
 * Fetch all tags from API
 */
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

/**
 * Update parsed preview in UI
 */
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
    notesP.innerHTML = `<strong>Notes:</strong><br><pre style="white-space: pre-wrap; font-family: inherit; margin: 4px 0 0 0; font-size: inherit;">${parsed.extractedNotes}</pre>`;
    notesP.style.display = 'block';
  } else {
    notesP.style.display = 'none';
  }
}

/**
 * Submit question data to API
 */
async function submitQuestionData() {
  const questionLink = document.getElementById('gmat-question-link').value.trim();
  const notes = document.getElementById('gmat-notes').value.trim();
  const submitBtn = document.getElementById('gmat-logger-submit');

  if (!questionLink && !notes) {
    showStatus('Please enter either a question link or notes.', 'error');
    return;
  }

  // Get tags from DOM
  const tagsContainer = document.getElementById('gmat-tags-container');
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
    if (extractQuestionFn) {
      console.log('Attempting to extract question from page...');
      const questionData = await extractQuestionFn();

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

    showStatus('✅ Question added successfully!', 'success');
    setTimeout(() => document.getElementById('gmat-logger-modal').remove(), 1500);
  } catch (error) {
    console.error('Submission error:', error);
    showStatus(`❌ Error: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Quick Add';
  }
}

/**
 * Setup event listeners for the modal
 */
function setupEventListeners() {
  const modal = document.getElementById('gmat-logger-modal');
  const form = document.getElementById('gmat-logger-form');
  const closeBtn = document.getElementById('gmat-logger-close');
  const cancelBtn = document.getElementById('gmat-logger-cancel');
  const questionLinkInput = document.getElementById('gmat-question-link');
  const notesTextarea = document.getElementById('gmat-notes');
  const tagsContainer = document.getElementById('gmat-tags-container');
  const toggleTagsBtn = document.getElementById('gmat-toggle-tags');
  const tagsList = document.getElementById('gmat-tags-list');
  const tagsExpanded = document.getElementById('gmat-tags-expanded');
  const suggestionsDiv = document.getElementById('gmat-suggestions');

  let currentSuggestions = [];
  let cursorPosition = 0;
  let tags = [];
  let allTags = [];

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

  function renderTagList(tags) {
    tagsList.innerHTML = '';
    tagsExpanded.innerHTML = '';

    const visibleTags = tags.slice(0, 6);

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

    tags.forEach(tag => {
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

  const closeModal = () => modal.remove();
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      e.preventDefault();
      closeModal();
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
  questionLinkInput.addEventListener('input', () => updateParsedPreview(questionLinkInput.value, notesTextarea.value));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitQuestionData();
  });

  fetchAllTags().then(fetchedTags => {
    allTags = fetchedTags;
    renderTagList(allTags);
  });

  updateParsedPreview(questionLinkInput.value, notesTextarea.value);
}

/**
 * Create and display the modal
 */
export async function createModal() {
  await fetchCategories();
  const existingModal = document.getElementById('gmat-logger-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'gmat-logger-modal';
  modal.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><div style="background:white;border-radius:12px;width:90%;max-width:500px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);max-height:90vh;overflow-y:auto;"><div style="padding:24px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="margin:0;font-size:20px;font-weight:600;color:#1f2937">⚡ Quick Log (Modular)</h2><button id="gmat-logger-close" style="background:none;border:none;font-size:24px;cursor:pointer;padding:4px;color:#6b7280">×</button></div><form id="gmat-logger-form" style="display:flex;flex-direction:column;"><div style="margin-bottom:16px"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px">Question Link</label><input id="gmat-question-link" type="url" placeholder="https://gmatclub.com/forum/..." style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box"/></div><div style="margin-bottom:16px"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px">Smart Notes</label><div style="position:relative"><textarea id="gmat-notes" placeholder="Type: weaken hard - my mistake was..." style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;min-height:80px;max-height:200px;font-family:inherit;box-sizing:border-box"></textarea><div id="gmat-suggestions" style="position:absolute;z-index:10;width:100%;margin-top:1px;background:white;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:none"></div></div><p style="font-size:12px;color:#6b7280;margin-top:4px;margin-bottom:0">Type keywords: <code style="background:#f3f4f6;padding:1px 4px;border-radius:3px">weaken</code>, <code style="background:#f3f4f6;padding:1px 4px;border-radius:3px">hard</code> and press Tab to complete.</p></div><div style="margin-bottom:16px"><div id="gmat-tags-container" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div><div id="gmat-tags-section" style="margin-top:8px"><div style="display:flex;justify-content:flex-start;margin-bottom:4px"><button type="button" id="gmat-toggle-tags" style="background:none;border:none;color:#3b82f6;font-size:12px;cursor:pointer;padding:0">See all</button></div><div id="gmat-tags-list" style="display:flex;flex-wrap:wrap;gap:4px;max-height:150px;overflow-y:auto"></div><div id="gmat-tags-expanded" style="display:none;flex-wrap:wrap;gap:4px;max-height:200px;overflow-y:auto"></div></div></div><div id="gmat-parsed-preview" style="background:rgba(156,163,175,0.1);padding:16px;border-radius:8px;margin-bottom:16px;display:none"><h4 style="font-weight:500;font-size:14px;color:#6b7280;margin:0 0 8px 0">Parsed Information:</h4><div id="gmat-parsed-badges" style="display:flex;flex-wrap:wrap;gap:8px"></div><p id="gmat-parsed-notes" style="font-size:12px;color:#6b7280;margin:8px 0 0 0;display:none;max-height:200px;overflow-y:auto"></p></div><div style="padding:16px 0 0 0;border-top:1px solid #e5e7eb;display:flex;gap:12px;justify-content:flex-end;"><button type="button" id="gmat-logger-cancel" style="padding:8px 16px;border:1px solid #d1d5db;background:white;color:#374151;border-radius:6px;font-size:14px;cursor:pointer">Cancel</button><button type="submit" id="gmat-logger-submit" style="padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:500">Quick Add</button></div></form><div id="gmat-logger-status" style="margin-top:16px;padding:12px;border-radius:6px;font-size:14px;display:none"></div></div></div></div>`;

  document.body.appendChild(modal);
  document.getElementById('gmat-question-link').value = window.location.href;
  setupEventListeners();
}
