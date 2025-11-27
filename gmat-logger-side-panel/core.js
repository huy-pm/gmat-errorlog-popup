/**
 * GMAT Logger Side Panel - Core Module
 * Sidebar UI, rendering, event handling, and API communication
 */

import {
  CONFIG,
  baseUrl,
  ICONS,
  sectionMappings,
  allSectionMappings,
  difficultyMappings,
  allDifficultyMappings,
  sourceMappings,
  detectSourceFromLink,
  createBadge,
  showStatus,
  enrichquestionData,
  getPracticeUrl
} from './utils.js';

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
    url: getPracticeUrl(window.location.href),
    notes: '',
    tags: [],
    source: document.title
  },
  aiReasoning: null,
  categories: [],
  allTags: [],
  extractQuestionFn: null,
  lastUrl: getPracticeUrl(window.location.href)
};

// ============================================================================
// EXTRACTOR MANAGEMENT
// ============================================================================

/**
 * Set the question extractor function
 * Called by loader after loading the appropriate extractor
 */
export function setQuestionExtractor(extractorFn) {
  state.extractQuestionFn = extractorFn;
}

// ============================================================================
// PARSING & AUTOCOMPLETE FUNCTIONS
// ============================================================================

function parseNotes(notes) {
  let originalNotes = notes;
  let selectedAnswer, correctAnswer, timeSpent;

  // Extract and remove selected answer, correct answer, and time using regex
  const selectedMatch = originalNotes.match(/Selected:\s*([A-E])/i);
  if (selectedMatch) {
    selectedAnswer = selectedMatch[1].toUpperCase();
    // Remove "Selected: X" from the notes
    originalNotes = originalNotes.replace(/Selected:\s*[A-E],?\s*/i, '');
  }

  const correctMatch = originalNotes.match(/Correct:\s*([A-E])/i);
  if (correctMatch) {
    correctAnswer = correctMatch[1].toUpperCase();
    // Remove "Correct: X" from the notes
    originalNotes = originalNotes.replace(/Correct:\s*[A-E],?\s*/i, '');
  }

  const timeMatch = originalNotes.match(/Time:\s*(\d{2}:\d{2})/);
  if (timeMatch) {
    timeSpent = timeMatch[1];
    // Remove "Time: XX:XX" from the notes
    originalNotes = originalNotes.replace(/Time:\s*\d{2}:\d{2},?\s*/i, '');
  }

  // Clean up any remaining " - " or extra commas
  originalNotes = originalNotes.replace(/\s*-\s*,\s*/g, ' - ');
  originalNotes = originalNotes.replace(/\s+-\s*$/gm, ''); // Remove trailing " -" at end of lines (with any preceding whitespace)
  originalNotes = originalNotes.replace(/\s*-\s*\n+/g, '\n'); // Remove " - " before one or more newlines
  originalNotes = originalNotes.trim();

  const normalizedNotes = originalNotes.toLowerCase().trim();
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
    return { section, category, difficulty, source, selectedAnswer, correctAnswer, timeSpent, extractedNotes: originalNotes || undefined };
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

  // Remove any remaining standalone dashes with surrounding whitespace
  extractedNotes = extractedNotes.replace(/^\s*-\s*/gm, ''); // Remove leading dash on any line
  extractedNotes = extractedNotes.trim();

  return { section, category, difficulty, source, selectedAnswer, correctAnswer, timeSpent, extractedNotes: extractedNotes || undefined };
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
// UI HELPER FUNCTIONS
// ============================================================================

function saveFormValuesToState(root) {
  const questionLinkInput = root.getElementById('gmat-question-link');
  const notesTextarea = root.getElementById('gmat-notes');

  if (questionLinkInput) {
    state.logData.url = questionLinkInput.value;
  }

  if (notesTextarea) {
    state.logData.notes = notesTextarea.value;
  }

  // Tags are already saved to state.logData.tags by the toggleTag function
}

function updateParsedPreview(questionLink, notes, root) {
  const parsed = parseNotesAndLink(notes, questionLink);
  const previewDiv = root.getElementById('gmat-parsed-preview');
  const badgesDiv = root.getElementById('gmat-parsed-badges');
  const notesP = root.getElementById('gmat-parsed-notes');

  if (!parsed.source && !parsed.section && !parsed.category && !parsed.difficulty && !parsed.selectedAnswer && !parsed.correctAnswer && !parsed.timeSpent && !parsed.extractedNotes) {
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

  // Add selected answer badge
  if (parsed.selectedAnswer) {
    badgesDiv.appendChild(createBadge(`Selected: ${parsed.selectedAnswer}`, 'default'));
  }

  // Add correct answer badge (with different color if incorrect)
  if (parsed.correctAnswer) {
    const isIncorrect = parsed.selectedAnswer && parsed.selectedAnswer !== parsed.correctAnswer;
    badgesDiv.appendChild(createBadge(`Correct: ${parsed.correctAnswer}`, isIncorrect ? 'red' : 'green'));
  }

  // Add time spent badge
  if (parsed.timeSpent) {
    badgesDiv.appendChild(createBadge(`Time: ${parsed.timeSpent}`, 'default'));
  }

  if (parsed.extractedNotes) {
    notesP.innerHTML = `<strong>Notes:</strong><br><pre style="white-space: pre-wrap; font-family: inherit; margin: 4px 0 0 0; font-size: inherit;">${parsed.extractedNotes}</pre>`;
    notesP.style.display = 'block';
  } else {
    notesP.style.display = 'none';
  }
}

function clearFormValues(root) {
  console.log('[Debug] Clearing form values');

  // Clear state values
  state.logData = {
    url: window.location.href,
    notes: '',
    tags: [],
    source: document.title
  };

  // Clear question link (reset to current URL)
  const questionLinkInput = root.getElementById('gmat-question-link');
  if (questionLinkInput) {
    questionLinkInput.value = window.location.href;
  }

  // Clear notes
  const notesTextarea = root.getElementById('gmat-notes');
  if (notesTextarea) {
    notesTextarea.value = '';
  }

  // Re-render tag list to reflect cleared state
  // Tags will show as unselected since state.logData.tags is now empty
  if (state.allTags && state.allTags.length > 0) {
    const tagsList = root.getElementById('gmat-tags-list');
    if (tagsList) {
      // Re-render all tags with none selected
      tagsList.innerHTML = '';
      state.allTags.forEach(tag => {
        const tagName = tag.name || tag;
        const btn = document.createElement('button');
        btn.className = 'px-3 py-1 rounded-full text-xs border transition-all bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50';
        btn.textContent = tagName;
        tagsList.appendChild(btn);
      });
    }
  }

  // Hide parsed preview
  const previewDiv = root.getElementById('gmat-parsed-preview');
  if (previewDiv) {
    previewDiv.style.display = 'none';
  }

  // Clear status message
  const statusDiv = root.getElementById('gmat-logger-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
  }

  console.log('[Debug] Form cleared successfully');
}

function handleUrlChange(root) {
  const currentUrl = window.location.href;
  const practiceUrl = getPracticeUrl(currentUrl);

  if (currentUrl !== state.lastUrl) {
    console.log('[Debug] URL changed from', state.lastUrl, 'to', currentUrl);
    state.lastUrl = currentUrl;

    // Update the question link field with practice URL
    const questionLinkInput = root.getElementById('gmat-question-link');
    if (questionLinkInput) {
      questionLinkInput.value = practiceUrl;
      state.logData.url = practiceUrl;
    }

    // Automatically refresh data from new page
    if (state.extractQuestionFn && state.activeTab === 'log') {
      console.log('[Debug] Auto-refreshing data for new URL');
      refreshData(root, true); // Pass true to indicate auto-refresh (skip some UI updates)
    }
  }
}

async function refreshData(root, isAutoRefresh = false) {
  console.log('[Debug] refreshData called', isAutoRefresh ? '(auto)' : '(manual)');

  if (!state.extractQuestionFn) {
    console.log('[Debug] No extractor available for this page');
    if (!isAutoRefresh) {
      showStatus('⚠️ No extractor available for this page', 'error', root);
    }
    return;
  }

  const notesTextarea = root.getElementById('gmat-notes');
  const refreshBtn = root.getElementById('btn-refresh');

  if (!notesTextarea) {
    console.error('[Debug] Notes textarea not found');
    return;
  }

  try {
    // Show loading state (only for manual refresh)
    let originalIcon;
    if (!isAutoRefresh && refreshBtn) {
      originalIcon = refreshBtn.innerHTML;
      refreshBtn.innerHTML = ICONS.loader;
      refreshBtn.disabled = true;
    }
    console.log('[Debug] Extracting fresh data from page...');

    // Extract fresh data from page
    const questionData = await state.extractQuestionFn();

    if (!questionData) {
      console.log('[Debug] No question data extracted');
      if (!isAutoRefresh) {
        showStatus('⚠️ Could not extract data from page', 'error', root);
        if (refreshBtn) {
          refreshBtn.innerHTML = originalIcon;
          refreshBtn.disabled = false;
        }
      }
      return;
    }

    console.log('[Debug] Fresh data extracted:', questionData);

    // Parse current notes to preserve user's custom text
    const currentNotes = notesTextarea.value;
    const questionLinkInput = root.getElementById('gmat-question-link');
    const parsed = parseNotesAndLink(currentNotes, questionLinkInput?.value || '');

    // Build new auto-populated notes
    let autoNotes = '';

    // Add category if available
    if (questionData.content && questionData.content.category) {
      autoNotes += questionData.content.category;
    }

    // Add difficulty if available
    if (questionData.difficulty) {
      if (autoNotes) autoNotes += ' ';
      autoNotes += questionData.difficulty;
    }

    // Add selected and correct answers if available
    let isIncorrect = false;
    if (questionData.selectedAnswer) {
      if (autoNotes) autoNotes += ' ';
      autoNotes += `Selected:${questionData.selectedAnswer}`;

      // Add correct answer if available
      if (questionData.correctAnswer) {
        autoNotes += ` Correct:${questionData.correctAnswer}`;

        // Check if answer is incorrect
        if (questionData.selectedAnswer !== questionData.correctAnswer) {
          isIncorrect = true;
        }
      }
    }

    // Add time spent if available
    if (questionData.timeSpent) {
      if (autoNotes) autoNotes += ' ';
      autoNotes += `Time:${questionData.timeSpent}`;
    }

    // Preserve user's custom notes (text that's not auto-generated)
    let customNotes = '';
    if (parsed.extractedNotes) {
      // Remove old reflection prompts before preserving custom notes
      customNotes = parsed.extractedNotes
        .replace(/\n*Why did I choose [A-E]\?\s*/g, '')  // Remove old prompts
        .trim();
    }

    // Combine: auto-notes + custom notes
    let finalNotes = autoNotes;
    if (customNotes && customNotes.trim()) {
      if (finalNotes) finalNotes += ' - ';
      finalNotes += customNotes;
    }

    // Add/update reflection prompt if answer is incorrect
    if (isIncorrect) {
      finalNotes += `\n\nWhy did I choose ${questionData.selectedAnswer}?\n`;
    } else if (!isIncorrect && finalNotes) {
      finalNotes += '\n';
    }

    // Update the notes field
    notesTextarea.value = finalNotes;
    state.logData.notes = finalNotes;

    // Position cursor at the end
    const cursorPos = finalNotes.length;
    notesTextarea.setSelectionRange(cursorPos, cursorPos);

    // Trigger update of suggestions and parsed preview
    const event = new Event('input', { bubbles: true });
    notesTextarea.dispatchEvent(event);

    // Show success feedback (only for manual refresh)
    if (!isAutoRefresh) {
      showStatus('✓ Data refreshed from page', 'success', root);
    }
    console.log('[Debug] Data refreshed successfully', isAutoRefresh ? '(auto)' : '(manual)');

    // Restore button state (only for manual refresh)
    if (!isAutoRefresh && refreshBtn) {
      setTimeout(() => {
        refreshBtn.innerHTML = originalIcon;
        refreshBtn.disabled = false;
      }, 300);
    }

  } catch (error) {
    console.error('[Debug] Refresh error:', error);
    if (!isAutoRefresh) {
      showStatus('❌ Error refreshing data', 'error', root);
      const refreshBtn = root.getElementById('btn-refresh');
      if (refreshBtn) {
        refreshBtn.innerHTML = ICONS.refresh;
        refreshBtn.disabled = false;
      }
    }
  }
}

async function submitQuestionData(root) {
  console.log('[Debug] submitQuestionData called');

  const questionLink = root.getElementById('gmat-question-link').value.trim();
  const notes = root.getElementById('gmat-notes').value.trim();
  const submitBtn = root.getElementById('gmat-logger-submit');

  console.log('[Debug] Question Link:', questionLink);
  console.log('[Debug] Notes:', notes);
  console.log('[Debug] Submit Button:', submitBtn);

  if (!questionLink && !notes) {
    console.log('[Debug] Validation failed - no link or notes');
    showStatus('Please enter either a question link or notes.', 'error', root);
    return;
  }

  // Get tags from state (already maintained by toggle buttons)
  const tags = state.logData.tags || [];
  console.log('[Debug] Final tags to submit:', tags);

  const parsed = parseNotesAndLink(notes, questionLink);

  // Convert time from MM:SS to seconds
  let timeInSeconds = null;
  if (parsed.timeSpent) {
    const timeParts = parsed.timeSpent.split(':');
    if (timeParts.length === 2) {
      const minutes = parseInt(timeParts[0], 10);
      const seconds = parseInt(timeParts[1], 10);
      timeInSeconds = (minutes * 60) + seconds;
      console.log('[Debug] Converted time:', parsed.timeSpent, '->', timeInSeconds, 'seconds');
    }
  }

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

  // Add selected answer and time to payload
  if (parsed.selectedAnswer) {
    payload.selectedAnswer = parsed.selectedAnswer;
  }
  if (timeInSeconds !== null) {
    payload.timeSpent = timeInSeconds;
  }

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

        // Remove the extracted answer/time fields from questionData (they're now in notes/payload)
        delete enrichedJson.selectedAnswer;
        delete enrichedJson.correctAnswer;
        delete enrichedJson.timeSpent;

        // Add correct answer to questionData.content if available from parsed notes
        if (parsed.correctAnswer && enrichedJson.content) {
          enrichedJson.content.correctAnswer = parsed.correctAnswer;
          console.log('[Debug] Added correct answer to questionData.content.correctAnswer:', parsed.correctAnswer);
        }

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

    console.log('[Debug] Sending payload to API:', payload);
    console.log('[Debug] API URL:', `${baseUrl}/api/questions`);

    const response = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('[Debug] API Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      console.error('[Debug] API Error:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    console.log('[Debug] Question added successfully!');
    showStatus('✅ Question added successfully!', 'success', root);

    // Clear form values after successful submission
    setTimeout(() => {
      // Clear state values
      state.logData = {
        url: getPracticeUrl(window.location.href),
        notes: '',
        tags: [],
        source: document.title
      };

      // Re-render the entire tab to properly reset everything including event listeners
      render();

      // Collapse sidebar after clearing
      setTimeout(() => {
        state.isCollapsed = true;
        updateSidebarLayout();
      }, 500);
    }, 1000);
  } catch (error) {
    console.error('Submission error:', error);
    showStatus(`❌ Error: ${error.message}`, 'error', root);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Quick Add';
  }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderLogTab(parent, root) {
  parent.innerHTML = '';

  // Use state values if available, otherwise use defaults (converted to practice URL)
  const questionLinkValue = state.logData.url || getPracticeUrl(window.location.href);
  const notesValue = state.logData.notes || '';

  const questionLinkGroup = document.createElement('div');
  questionLinkGroup.className = "space-y-2";
  questionLinkGroup.innerHTML = `
    <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.link} Question Link</label>
    <input id="gmat-question-link" type="text" value="${questionLinkValue}" class="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
  `;
  parent.appendChild(questionLinkGroup);

  const notesGroup = document.createElement('div');
  notesGroup.className = "space-y-2";
  notesGroup.innerHTML = `
    <div class="flex items-center justify-between">
      <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.fileText} Smart Notes</label>
      <button id="btn-refresh" class="text-gray-400 hover:text-blue-600 transition p-1 flex items-center gap-1 text-xs font-medium" title="Refresh data from page">
        ${ICONS.refresh}
        <span class="hidden sm:inline">Refresh</span>
      </button>
    </div>
    <div class="relative">
      <textarea id="gmat-notes" placeholder="Type: weaken hard - my mistake was..." class="w-full p-3 border border-gray-300 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-gray-700 leading-relaxed">${notesValue}</textarea>
      <div id="gmat-suggestions" style="position:absolute;z-index:10;width:100%;margin-top:1px;background:white;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:none"></div>
    </div>
    <p class="text-xs text-gray-500">💡 Click refresh to update after revealing answer. Or type keywords: <code class="bg-gray-100 px-1.5 py-0.5 rounded">weaken</code>, <code class="bg-gray-100 px-1.5 py-0.5 rounded">hard</code> and press Tab.</p>
  `;
  parent.appendChild(notesGroup);

  const tagsSection = document.createElement('div');
  tagsSection.className = "space-y-3";
  tagsSection.innerHTML = `
    <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.tag} Mistake Tags</label>
    <div id="gmat-tags-list" class="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar"></div>
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

  // Note: Status message moved to footer for better visibility
  // Note: Event listeners will be set up in attachEvents() after DOM is ready
}

function setupLogTabEvents(root) {
  const questionLinkInput = root.getElementById('gmat-question-link');
  const notesTextarea = root.getElementById('gmat-notes');
  const tagsList = root.getElementById('gmat-tags-list');
  const suggestionsDiv = root.getElementById('gmat-suggestions');

  // Safety check - ensure all required elements exist
  if (!questionLinkInput || !notesTextarea || !tagsList || !suggestionsDiv) {
    console.error('Log tab elements not found in DOM');
    return;
  }

  let currentSuggestions = [];
  let cursorPosition = 0;
  // Initialize tags from state
  let tags = [...(state.logData.tags || [])];

  function renderTagList(allTags) {
    tagsList.innerHTML = '';

    allTags.forEach(tag => {
      const tagName = tag.name || tag;
      const btn = document.createElement('button');
      const isActive = tags.includes(tagName);
      btn.className = `px-3 py-1 rounded-full text-xs border transition-all ${isActive ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`;
      btn.textContent = tagName;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTag(tagName);
      };
      tagsList.appendChild(btn);
    });
  }

  function toggleTag(tag) {
    if (tags.includes(tag)) {
      tags = tags.filter(t => t !== tag);
    } else {
      tags.push(tag);
    }
    // Update state when tags change
    state.logData.tags = [...tags];
    renderTagList(state.allTags);
  }


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
    // Save to state as user types
    state.logData.notes = e.target.value;
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
  questionLinkInput.addEventListener('input', () => {
    updateParsedPreview(questionLinkInput.value, notesTextarea.value, root);
    // Save to state as user types
    state.logData.url = questionLinkInput.value;
  });

  // Fetch and render tags from API/local storage
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

// ============================================================================
// SIDEBAR UI & LAYOUT
// ============================================================================

let sidebarContainer, shadow, container;

function updateSidebarLayout() {
  if (state.isCollapsed) {
    sidebarContainer.style.transform = 'translateX(100%)';
    document.body.style.marginRight = '0px';
    document.getElementById('smartlog-expand-button').style.display = 'block';
  } else {
    sidebarContainer.style.transform = 'translateX(0)';
    sidebarContainer.style.width = `${state.sidebarWidth}px`;
    document.body.style.marginRight = `${state.sidebarWidth}px`;
    document.getElementById('smartlog-expand-button').style.display = 'none';

    // Focus the notes textarea when sidebar opens (if on log tab)
    if (state.activeTab === 'log') {
      // Wait for animation to complete before focusing
      setTimeout(() => {
        const notesTextarea = shadow.getElementById('gmat-notes');
        if (notesTextarea) {
          notesTextarea.focus();
          // Move cursor to end of text
          const textLength = notesTextarea.value.length;
          notesTextarea.setSelectionRange(textLength, textLength);
        }
      }, 350); // Slightly longer than the 300ms transition
    }
  }
}

function render() {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = "p-4 border-b border-gray-200 flex justify-between items-center bg-white";
  header.innerHTML = `
    <div class="flex items-center space-x-2 text-gray-800">
      <div class="bg-yellow-100 p-1.5 rounded-md">${ICONS.zap}</div>
      <h2 class="font-bold text-lg">Smart Log</h2>
    </div>
    <div class="flex items-center gap-2">
      <button id="btn-settings" class="text-gray-400 hover:text-gray-600 transition p-1" title="Settings">
         ${ICONS.settings}
      </button>
      <button id="btn-minimize" class="text-gray-400 hover:text-gray-600 transition p-1" title="Minimize Sidebar">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <button id="btn-close" class="text-gray-400 hover:text-red-600 transition p-1" title="Close Sidebar">
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
        Smart Log
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
    footer.className = "border-t border-gray-200 bg-gray-50";
    footer.innerHTML = `
      <div id="gmat-logger-status" style="display:none;margin:12px 16px 0 16px;padding:12px;border-radius:6px;font-size:14px;font-weight:500;text-align:center;"></div>
      <div class="p-4 flex justify-end space-x-3">
        <button id="btn-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-300 rounded-lg transition">Cancel</button>
        <button id="${state.activeTab === 'log' ? 'gmat-logger-submit' : 'btn-save'}" class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition">Quick Add</button>
      </div>
    `;
    container.appendChild(footer);
  }

  attachEvents(shadow);
}

function attachEvents(root) {
  root.getElementById('btn-close')?.addEventListener('click', () => {
    // Completely close and destroy the sidebar
    destroySidebar();
  });
  root.getElementById('btn-minimize')?.addEventListener('click', () => {
    // Save form values before minimizing
    if (state.activeTab === 'log') {
      saveFormValuesToState(root);
    }
    state.isCollapsed = true;
    updateSidebarLayout();
  });
  root.getElementById('btn-refresh')?.addEventListener('click', () => {
    if (state.activeTab === 'log') {
      refreshData(root);
    }
  });
  root.getElementById('btn-settings')?.addEventListener('click', () => {
    // Save form values before switching tabs
    if (state.activeTab === 'log') {
      saveFormValuesToState(root);
    }
    state.activeTab = 'settings';
    render();
  });
  root.getElementById('tab-log')?.addEventListener('click', () => {
    // Save form values if coming from another tab
    if (state.activeTab === 'log') {
      saveFormValuesToState(root);
    }
    state.activeTab = 'log';
    render();
  });
  root.getElementById('tab-ai')?.addEventListener('click', () => {
    // Save form values before switching tabs
    if (state.activeTab === 'log') {
      saveFormValuesToState(root);
    }
    state.activeTab = 'ai';
    render();
  });
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
  root.getElementById('btn-cancel')?.addEventListener('click', () => {
    // Save form values before closing
    if (state.activeTab === 'log') {
      saveFormValuesToState(root);
    }
    state.isCollapsed = true;
    updateSidebarLayout();
  });

  // Manual Log tab specific events
  if (state.activeTab === 'log') {
    // Submit button
    const submitBtn = root.getElementById('gmat-logger-submit');
    console.log('[Debug] Submit button found:', submitBtn);

    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        console.log('[Debug] Submit button clicked!');
        e.preventDefault();
        submitQuestionData(root);
      });
    } else {
      console.error('[Error] Submit button not found in DOM');
    }

    // Set up all log tab event listeners (notes, tags, autocomplete, etc.)
    setupLogTabEvents(root);
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

// ============================================================================
// INITIALIZATION & EXPORTS
// ============================================================================

function destroySidebar() {
  console.log('[Debug] Destroying sidebar...');

  // Remove the sidebar container
  const sidebarElement = document.getElementById('smartlog-split-container');
  if (sidebarElement) {
    sidebarElement.remove();
  }

  // Remove the expand button
  const expandButton = document.getElementById('smartlog-expand-button');
  if (expandButton) {
    expandButton.remove();
  }

  // Reset body margin
  document.body.style.marginRight = '0px';

  // Clear the URL check interval
  if (window.__SMARTLOG_URL_CHECK_INTERVAL__) {
    clearInterval(window.__SMARTLOG_URL_CHECK_INTERVAL__);
    window.__SMARTLOG_URL_CHECK_INTERVAL__ = null;
  }

  // Reset the injection flag
  window.__SMARTLOG_INJECTED__ = false;

  console.log('[Debug] Sidebar destroyed');
}

export async function createSidebar() {
  // Prevent multiple injections
  if (document.getElementById('smartlog-split-container')) {
    alert('SmartLog AI Sidebar is already open!');
    return;
  }

  window.__SMARTLOG_INJECTED__ = true;

  // Fetch categories first
  await fetchCategories();

  // Create sidebar container
  sidebarContainer = document.createElement('div');
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
    updateSidebarLayout();
  };

  // Assemble
  sidebarContainer.appendChild(resizeHandle);
  sidebarContainer.appendChild(contentArea);
  document.body.appendChild(sidebarContainer);
  document.body.appendChild(expandButton);

  // Adjust Body Margin
  const originalBodyTransition = document.body.style.transition;
  document.body.style.transition = 'margin-right 0.3s ease-in-out';

  updateSidebarLayout();

  // Modal detection
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

  // Resize Logic
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
      sidebarContainer.style.transition = 'transform 0.2s ease-in-out';
      document.body.style.transition = 'margin-right 0.2s ease-in-out';
    }
  });

  // Shadow DOM & Styles
  shadow = contentArea.attachShadow({ mode: 'open' });

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
    .fade-in { animation: fadeIn 0.2s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  `;
  shadow.appendChild(customStyles);

  container = document.createElement('div');
  container.className = "bg-white h-full flex flex-col text-gray-800 font-sans";
  shadow.appendChild(container);

  // Keyboard Shortcut: Ctrl+L (Cmd+L on Mac)
  document.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isLKey = e.key === 'l' || e.key === 'L';

    if (isCtrlOrCmd && isLKey) {
      e.preventDefault();
      state.isCollapsed = !state.isCollapsed;
      updateSidebarLayout();
      console.log(`[SmartLog] Sidebar ${state.isCollapsed ? 'collapsed' : 'expanded'} via keyboard shortcut`);
    }
  });

  // Initial render
  render();

  // Auto-populate notes with extracted difficulty and category
  if (state.extractQuestionFn) {
    console.log('[Debug] Auto-populate: Extractor available, attempting to extract...');

    // Use setTimeout to ensure DOM is ready
    setTimeout(async () => {
      try {
        const notesTextarea = shadow.getElementById('gmat-notes');

        if (!notesTextarea) {
          console.warn('[Debug] Auto-populate: Notes textarea not found');
          return;
        }

        console.log('[Debug] Auto-populate: Extracting question data...');
        const questionData = await state.extractQuestionFn();

        if (questionData) {
          console.log('[Debug] Auto-populate: Question data extracted:', questionData);
          let autoNotes = '';

          // Add category if available (for CR questions)
          if (questionData.content && questionData.content.category) {
            autoNotes += questionData.content.category;
            console.log('[Debug] Auto-populate: Found category:', questionData.content.category);
          }

          // Add difficulty if available
          if (questionData.difficulty) {
            if (autoNotes) autoNotes += ' ';
            autoNotes += questionData.difficulty;
            console.log('[Debug] Auto-populate: Found difficulty:', questionData.difficulty);
          }

          // Add selected and correct answers if available
          let isIncorrect = false;
          if (questionData.selectedAnswer) {
            if (autoNotes) autoNotes += ' ';
            autoNotes += `Selected:${questionData.selectedAnswer}`;
            console.log('[Debug] Auto-populate: Found selected answer:', questionData.selectedAnswer);

            // Add correct answer if available
            if (questionData.correctAnswer) {
              autoNotes += ` Correct:${questionData.correctAnswer}`;
              console.log('[Debug] Auto-populate: Found correct answer:', questionData.correctAnswer);

              // Check if answer is incorrect
              if (questionData.selectedAnswer !== questionData.correctAnswer) {
                isIncorrect = true;
                console.log('[Debug] Auto-populate: Incorrect answer detected');
              }
            }
          }

          // Add time spent if available
          if (questionData.timeSpent) {
            if (autoNotes) autoNotes += ' ';
            autoNotes += `Time:${questionData.timeSpent}`;
            console.log('[Debug] Auto-populate: Found time spent:', questionData.timeSpent);
          }

          // Add reflection prompt if answer is incorrect
          if (isIncorrect) {
            autoNotes += `\n\nWhy did I choose ${questionData.selectedAnswer}?\n`;
            console.log('[Debug] Auto-populate: Added reflection prompt for incorrect answer');
          }

          // Set the notes field with auto-detected values
          if (autoNotes) {
            notesTextarea.value = autoNotes + (isIncorrect ? '' : '\n');
            // Update state with auto-populated notes
            state.logData.notes = autoNotes + (isIncorrect ? '' : '\n');
            // Position cursor at the end
            const cursorPos = autoNotes.length + (isIncorrect ? 0 : 1);
            notesTextarea.setSelectionRange(cursorPos, cursorPos);
            console.log('[Debug] Auto-populate: Notes set to:', autoNotes);

            // Trigger update of suggestions and parsed preview
            const event = new Event('input', { bubbles: true });
            notesTextarea.dispatchEvent(event);
          } else {
            console.log('[Debug] Auto-populate: No category, difficulty, or answers found');
          }
        } else {
          console.log('[Debug] Auto-populate: No question data extracted');
        }
      } catch (error) {
        console.error('[Debug] Auto-populate error:', error);
      }
    }, 100);
  } else {
    console.log('[Debug] Auto-populate: No extractor available for this page');
  }

  // ============================================================================
  // URL CHANGE MONITORING
  // ============================================================================

  // Monitor URL changes and auto-refresh data
  console.log('[Debug] Setting up URL change monitoring');

  // Listen for browser navigation (back/forward buttons)
  window.addEventListener('popstate', () => {
    console.log('[Debug] Popstate event detected');
    handleUrlChange(shadow);
  });

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    console.log('[Debug] Hashchange event detected');
    handleUrlChange(shadow);
  });

  // Backup: Poll for URL changes every 500ms (catches SPA navigation)
  const urlCheckInterval = setInterval(() => {
    handleUrlChange(shadow);
  }, 500);

  // Store interval ID for cleanup if needed
  window.__SMARTLOG_URL_CHECK_INTERVAL__ = urlCheckInterval;

  console.log('[Debug] URL change monitoring active');
}
