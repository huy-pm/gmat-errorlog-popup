/**
 * GMAT Logger Modular - Shared Utilities
 * Shared constants and helper functions used across modules
 */

// Configuration
export const CONFIG = {
  apiUrl: 'https://gmat-errorlog.vercel.app',
  devUrl: 'http://localhost:5001',
  version: '2.0.0-modular'
};

// Determine base URL
const isLocalhost = window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.href.includes('localhost');
export const baseUrl = isLocalhost ? CONFIG.devUrl : CONFIG.apiUrl;

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
export function showStatus(message, type) {
  const statusDiv = document.getElementById('gmat-logger-status');
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

/**
 * Load external script dynamically
 */
export function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

/**
 * Enrich question JSON with bookmarklet data
 */
export function enrichquestionData(questionData, payload) {
  if (!questionData) return null;

  // Map bookmarklet data to question JSON
  questionData.question_link = payload.question || questionData.question_link;
  questionData.difficulty = payload.difficulty || questionData.difficulty;
  questionData.source = payload.source || questionData.source;

  return questionData;
}
