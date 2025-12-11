/**
 * GMAT Logger Side Panel - Shared Utilities
 * Shared constants, icons, and helper functions used across modules
 */

// Configuration
export const CONFIG = {
  apiUrl: 'https://gmat-errorlog.vercel.app',
  devUrl: 'http://localhost:5001',
  version: '2.1.0-sidebar-modular'
};

// Determine base URL
const isLocalhost = window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.href.includes('localhost');
export const baseUrl = CONFIG.devUrl//isLocalhost ? CONFIG.devUrl : CONFIG.apiUrl;

/**
 * Convert review URL to practice URL for GMAT Hero
 * Example: /review/62 -> /practice/62
 */
export function getPracticeUrl(url) {
  if (url && url.includes('https://gmat-hero-v2.web.app/')) {
    return url.replace('/review/', '/practice/');
  }
  return url;
}

// --- Icons (SVG Strings) ---
export const ICONS = {
  zap: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-600"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  tag: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l5 5a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-5-5z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
  fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  loader: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
  brain: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
  gripVertical: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`
};

// Mappings for parsing
export const sectionMappings = {
  'vb': 'verbal',
  'verbal': 'verbal',
  'qt': 'quant',
  'quant': 'quant',
  'quantitative': 'quant',
  'di': 'di',
  'data': 'di',
  'data insights': 'di'
};

export const allSectionMappings = {
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

export const difficultyMappings = {
  'easy': 'easy',
  'med': 'medium',
  'medium': 'medium',
  'hard': 'hard'
};

export const allDifficultyMappings = {
  'e': 'easy',
  'easy': 'easy',
  'm': 'medium',
  'med': 'medium',
  'medium': 'medium',
  'h': 'hard',
  'hard': 'hard'
};

export const sourceMappings = {
  'og': 'OG',
  'official': 'OG',
  'guide': 'OG',
  'gmat': 'GMATClub',
  'club': 'GMATClub',
  'gmatclub': 'GMATClub',
  'ttp': 'TTP',
  'target test prep': 'TTP'
};

export const urlSourceMappings = [
  { pattern: /gmat-hero-v2\.web\.app/i, source: 'OG' },
  { pattern: /gmatclub\.com\/forum/i, source: 'GMATClub' },
  { pattern: /targettestprep\.com/i, source: 'TTP' }
];

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(text) {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

/**
 * Detect source from URL
 */
export function detectSourceFromLink(url) {
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

/**
 * Detect which question source we're on
 */
export function detectQuestionSource(url) {
  if (!url) return null;
  if (url.includes('gmatclub.com')) {
    return 'gmatclub';
  } else if (url.includes('gmat-hero-v2.web.app')) {
    return 'gmathero';
  } else if (url.includes('gmatofficialpractice.mba.com')) {
    return 'gmatog';
  }
  return null;
}

/**
 * Create a styled badge element
 */
export function createBadge(text, variant) {
  const badge = document.createElement('span');
  const styles = {
    green: {
      background: '#dcfce7',
      border: '1px solid #bbf7d0',
      color: '#166534'
    },
    red: {
      background: '#fee2e2',
      border: '1px solid #fecaca',
      color: '#991b1b'
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

/**
 * Show status message in the UI
 */
export function showStatus(message, type, root) {
  const statusDiv = root.getElementById('gmat-logger-status');
  if (!statusDiv) return;

  statusDiv.style.display = 'block';
  statusDiv.textContent = message;
  const styles = {
    success: {
      background: '#dcfce7',
      color: '#166534',
      border: '2px solid #86efac',
      boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.2), 0 2px 4px -1px rgba(34, 197, 94, 0.1)'
    },
    error: {
      background: '#fef2f2',
      color: '#dc2626',
      border: '2px solid #fca5a5',
      boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2), 0 2px 4px -1px rgba(220, 38, 38, 0.1)'
    },
    default: {
      background: '#f3f4f6',
      color: '#374151',
      border: '1px solid #d1d5db',
      boxShadow: 'none'
    }
  };
  const style = styles[type] || styles.default;
  Object.assign(statusDiv.style, style);

  // Add fade-in animation
  statusDiv.style.animation = 'fadeIn 0.2s ease-in';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusDiv.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 200); // Wait for fade-out animation to complete
  }, 2000);
}

/**
 * Enrich question JSON with bookmarklet data
 */
export function enrichquestionData(questionData, payload) {
  if (!questionData) return null;

  questionData.questionLink = payload.question || questionData.questionLink;
  questionData.difficulty = payload.difficulty || questionData.difficulty;
  questionData.source = payload.source || questionData.source;
  questionData.category = payload.category || questionData.category;

  return questionData;
}
