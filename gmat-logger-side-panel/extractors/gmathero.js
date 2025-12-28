/**
 * GMAT Logger Modular - GMAT Hero Extractor
 * Extracts questions from gmat-hero-v2.web.app pages
 */

/**
 * Decode HTML entities (duplicate from utils to avoid import caching issues)
 */
function decodeHtmlEntities(text) {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

/**
 * Escape currency symbols in plain text (e.g., $650, $21,300)
 * This should be called BEFORE KaTeX processing, when currency is plain text
 * and math expressions are still inside KaTeX elements.
 * 
 * Uses callback to check character after match to avoid regex backtracking issues
 */
function escapeCurrencyInTextNode(textNode) {
  var text = textNode.textContent;
  if (!text.includes('$')) return;

  // Match $NUMBER and use callback to check what follows
  var newText = text.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, function (match, number, offset, str) {
    // Check character immediately after the match
    var charAfter = str.charAt(offset + match.length);

    // If followed by a letter, it's a LaTeX variable like $0.125k - don't escape
    if (/[a-zA-Z]/.test(charAfter)) {
      return match;
    }

    // Otherwise, it's currency - escape it
    return '\\$' + number;
  });

  if (newText !== text) {
    textNode.textContent = newText;
  }
}

/**
 * Normalize currency format in extracted text
 * Converts KaTeX-wrapped currency like $\$247.00$ to just \$247.00
 * This ensures consistent output regardless of how GMAT Hero renders currency
 */
function normalizeCurrency(text) {
  // Pattern: $\$NUMBER$ - KaTeX wrapped escaped currency
  // Convert to just \$NUMBER
  return text.replace(/\$\\?\\\$(\d[\d,]*(?:\.\d+)?)\$/g, '\\$$$1');
}

/**
 * Walk through text nodes in an element and escape currency
 * Skips nodes that are inside KaTeX elements
 */
function escapeCurrencyInElement(element) {
  var walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        // Skip if inside a KaTeX element
        var parent = node.parentNode;
        while (parent && parent !== element) {
          if (parent.classList && parent.classList.contains('katex')) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  var textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach(escapeCurrencyInTextNode);
}

/**
 * Extract table data from a container and remove it from DOM
 */
function extractTable(container) {
  var tableElem = container.querySelector('table');
  if (!tableElem) return null;

  var rows = tableElem.querySelectorAll('tr');
  var headers = [];
  var data = [];

  rows.forEach(function (row, index) {
    var cells = row.querySelectorAll('td, th');
    var rowData = Array.from(cells).map(function (cell) {
      // Process any KaTeX in cell and get text
      var cellClone = cell.cloneNode(true);
      var katexElems = cellClone.querySelectorAll('.katex');
      katexElems.forEach(function (katexElem) {
        var annotation = katexElem.querySelector('annotation');
        if (annotation) {
          katexElem.replaceWith(document.createTextNode('$' + annotation.textContent + '$'));
        }
      });

      // Convert <sup> tags to LaTeX ^{content}
      var supElems = cellClone.querySelectorAll('sup');
      supElems.forEach(function (sup) {
        sup.replaceWith(document.createTextNode('^{' + sup.textContent + '}'));
      });

      // Convert <sub> tags to LaTeX _{content}
      var subElems = cellClone.querySelectorAll('sub');
      subElems.forEach(function (sub) {
        sub.replaceWith(document.createTextNode('_{' + sub.textContent + '}'));
      });

      // Get text and wrap in $ if it contains math notation
      var text = cellClone.textContent.trim();
      if (text.indexOf('^{') !== -1 || text.indexOf('_{') !== -1) {
        text = '$' + text + '$';
      }
      return text;
    });

    if (index === 0) {
      headers = headers.concat(rowData);
    } else {
      data.push(rowData);
    }
  });

  // Remove the table from container to clean up questionText
  tableElem.remove();

  return { headers: headers, rows: data };
}

/**
 * Convert styled spans to markdown format for boldface questions
 * Handles: <b>, <strong>, <i>, <em>, and styled <span> tags
 * - Italicized spans (font-style: italic) -> *text*
 * - Bold spans or default -> **text**
 */
function convertStyledSpansToMarkdown(htmlContent) {
  if (!htmlContent) return '';
  var result = htmlContent;

  // Convert <b> and <strong> tags to **text**
  result = result.replace(/<b>([^<]*)<\/b>/gi, '**$1**');
  result = result.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**');

  // Convert <i> and <em> tags to *text*
  result = result.replace(/<i>([^<]*)<\/i>/gi, '*$1*');
  result = result.replace(/<em>([^<]*)<\/em>/gi, '*$1*');

  // Handle styled spans
  result = result.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, function (match, content) {
    if (match.includes('font-style: italic') || match.includes('font-style:italic')) {
      return '*' + content + '*';
    }
    // Check if it's highlighted (background-color: yellow)
    if (match.includes('background-color: yellow') || match.includes('background-color:yellow') ||
      match.includes('background: yellow') || match.includes('background:yellow')) {
      return '==' + content + '==';
    }
    return '**' + content + '**';
  });
  return result;
}

/**
 * Convert highlighted text to markdown format for RC questions
 * - Yellow background spans -> ==text==
 * Supports both class-based ("highlight") and style-based (background-color: yellow) highlights
 */
function convertHighlightedTextToMarkdown(htmlContent) {
  if (!htmlContent) return '';
  // Match spans with yellow/highlight background - uses (.*?) to handle nested content
  return htmlContent.replace(/<span[^>]*(?:class="[^"]*highlight[^"]*"|style="[^"]*background[^"]*yellow[^"]*")[^>]*>(.*?)<\/span>/gi, function (match, content) {
    return '==' + content + '==';
  });
}

/**
 * Extract highlight ranges from text with ==marker== format
 * Returns { cleanText: string, highlightRanges: [{start: number, end: number}] }
 */
function extractHighlightRanges(textWithMarkers) {
  const highlightRanges = [];
  let cleanText = '';
  let lastIndex = 0;

  const regex = /==(.*?)==/g;
  let match;

  while ((match = regex.exec(textWithMarkers)) !== null) {
    const beforeHighlight = textWithMarkers.substring(lastIndex, match.index);
    cleanText += beforeHighlight;

    const start = cleanText.length;
    const highlightedContent = match[1];
    cleanText += highlightedContent;
    const end = cleanText.length;

    highlightRanges.push({ start, end });
    lastIndex = regex.lastIndex;
  }

  cleanText += textWithMarkers.substring(lastIndex);

  return { cleanText, highlightRanges };
}

/**
 * Shared patterns for sentence-completion style questions (synced with utils.js COMPLETION_PATTERNS)
 * If updating, also update: utils.js, gmatOG.js, gmatclub.js, gmat-og/*.js, gmat-hero/*.js, gmatclub/*.js
 */
var COMPLETION_PATTERNS = [
  /\bthat\s*$/i,           // ends with "that"
  /\bto\s*$/i,             // ends with "to" 
  /\bbecause\s*$/i,        // ends with "because"
  /\bfor\s*$/i,            // ends with "for"
  /\bwhich\s*$/i,          // ends with "which"
  /\bif\s*$/i,             // ends with "if"
  /\bby\s*$/i,             // ends with "by" (e.g., "responds to the argument by")
  /\bthe following\s*$/i,  // ends with "the following"
  /\bargument that\s*$/i,  // "argument that" pattern
  /\bconclusion that\s*$/i, // "conclusion that" pattern
  /\bassumption that\s*$/i, // "assumption that" pattern
  /\bstatement that\s*$/i,  // "statement that" pattern
  /\bevidence that\s*$/i,   // "evidence that" pattern
  /\bserves? as\s*$/i,      // "serve as" / "serves as" pattern
  /\bserves? to\s*$/i,      // "serve to" / "serves to" pattern
  /\bargument by\s*$/i,     // "argument by" pattern
  /\bresponds? to\s*$/i,    // "respond to" / "responds to" pattern (when at end)
];

function isCompletionStyleQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  var trimmed = text.trim();
  for (var i = 0; i < COMPLETION_PATTERNS.length; i++) {
    if (COMPLETION_PATTERNS[i].test(trimmed)) return true;
  }
  return false;
}

/**
 * Get practice URL from current URL (replace /review/ with /practice/)
 */
function getPracticeUrl() {
  const currentUrl = window.location.href;
  return currentUrl.replace('/review/', '/practice/');
}

/**
 * Detect the current question type based on DOM structure
 * @returns {string|null} Question type: 'quant', 'ds', 'cr', 'rc', 'di-gi', 'di-msr', 'di-ta', 'di-tpa', or null
 */
function detectQuestionType() {
  // DI Types (check first as they have specific containers)
  if (document.querySelector('.dropdown-selection')) return 'di-gi';
  if (document.querySelector('.ir-msr')) return 'di-msr';
  if (document.querySelector('.ir-ta')) return 'di-ta';
  if (document.querySelector('.tpa-question')) return 'di-tpa';

  // Verbal Types (use panel structure)
  if (document.querySelector('#left-panel .passage')) return 'rc';

  // Check for Data Sufficiency - look for DS answer choices pattern
  const standardChoices = document.querySelector('.standard-choices');
  if (standardChoices) {
    const choicesText = standardChoices.textContent || '';
    if (choicesText.includes('Statement (1) ALONE') ||
      choicesText.includes('Statement (2) ALONE') ||
      choicesText.includes('BOTH statements (1) and (2)')) {
      return 'ds';
    }
  }

  const hasQuestionStem = document.querySelector('#right-panel .question-stem');
  const hasPassage = document.querySelector('#left-panel .passage');
  const hasKaTeX = document.querySelector('.katex');

  // Also check question stem for (1) and (2) pattern as backup for DS
  if (hasQuestionStem) {
    const stemText = hasQuestionStem.textContent || '';
    const hasStatement1 = /\(1\)\s/.test(stemText);
    const hasStatement2 = /\(2\)\s/.test(stemText);
    if (hasStatement1 && hasStatement2) {
      return 'ds';
    }
  }

  // CR: has question stem but no passage and no KaTeX math
  if (hasQuestionStem && !hasPassage && !hasKaTeX) return 'cr';

  // Quant (has KaTeX math and not DI selectors)
  if (hasKaTeX) return 'quant';

  return null;
}

/**
 * Get section from question type
 */
function getSectionFromType(questionType) {
  if (!questionType) return 'unknown';
  if (questionType === 'quant') return 'quant';
  if (questionType === 'ds') return 'di';  // DS is under DI section
  if (questionType === 'cr' || questionType === 'rc') return 'verbal';
  if (questionType.startsWith('di-')) return 'di';
  return 'unknown';
}

/**
 * Get category label from question type
 */
function getCategoryFromType(questionType) {
  const categoryMap = {
    'di-gi': 'GI',
    'di-msr': 'MSR',
    'di-ta': 'TA',
    'di-tpa': 'TPA',
    'ds': 'DS',
    'cr': 'CR',
    'rc': 'RC',
    'quant': '' // Quant uses custom category from metadata
  };
  return categoryMap[questionType] || '';
}

/**
 * Extract metadata from GMAT Hero page (category, difficulty, selected/correct answers, time spent)
 * Similar to extractGmatHeroData from bookmarklet
 */
function extractGMATHeroMetadata() {
  const metadata = {
    isReviewMode: false,
    category: null,
    topic: null,
    selectedAnswer: null,
    difficulty: null,
    timeSpent: null,
    correctAnswer: null
  };

  // 1. Check is this review-mode
  const reviewModeEl = document.querySelector('.review-mode');
  metadata.isReviewMode = !!reviewModeEl;

  // 2. Extract category from .hide-small.centered
  const categoryEl = document.querySelector('.hide-small.centered');
  const url = window.location.href.toLowerCase();

  // Check for RC questions first (matching autoscraping script logic)
  if (url.includes('rc') || url.includes('rrc') || url.includes('og-rc') || url.includes('prep-rc')) {
    if (categoryEl) {
      const fullText = categoryEl.textContent.trim();
      const parts = fullText.split('-');
      if (parts.length > 1) {
        metadata.topic = parts[parts.length - 1].trim();
      } else {
        metadata.topic = fullText;
      }
    }
    metadata.category = "rc";
  }
  // Check for Quant and CR questions
  else if (url.includes('quant') || url.includes('qt') || url.includes('rq') ||
    url.includes('og-quant') || url.includes('prep-quant') ||
    url.includes('cr') || url.includes('rcr') ||
    url.includes('og-cr') || url.includes('prep-cr')) {
    if (categoryEl) {
      const fullText = categoryEl.textContent.trim();
      const parts = fullText.split('-');
      if (parts.length > 1) {
        metadata.category = parts[parts.length - 1].trim();
      } else {
        metadata.category = fullText;
      }
    }
  }
  else {
    metadata.category = "";
  }

  // 3. Extract selected answer
  // Priority 1: Check for selected-answer class (most reliable for current selection)
  const selectedLabel = document.querySelector('.selected-answer');
  if (selectedLabel) {
    const forAttr = selectedLabel.getAttribute('for');
    if (forAttr) {
      const parts = forAttr.split('-');
      metadata.selectedAnswer = parts[parts.length - 1];

      // Check if it is correct (parent standard-choices has 'has-answered-correctly')
      const standardChoices = selectedLabel.closest('.standard-choices');
      if (standardChoices && standardChoices.classList.contains('has-answered-correctly')) {
        metadata.correctAnswer = metadata.selectedAnswer;
      }
    }
  }

  // Priority 2: Fallback to round-div (history) if selected-answer not found
  if (!metadata.selectedAnswer) {
    const roundDivs = document.querySelectorAll('.round-div');
    if (roundDivs.length > 0) {
      const lastRoundDiv = roundDivs[roundDivs.length - 1];
      metadata.selectedAnswer = lastRoundDiv.textContent.trim();

      // Check if selected answer is correct (has 'green' class)
      if (lastRoundDiv.classList.contains('green')) {
        metadata.correctAnswer = metadata.selectedAnswer;
      }
    }
  }

  // 3. Extract difficulty from .level-badge and map to easy/medium/hard
  const levelBadgeEl = document.querySelector('.level-badge');
  if (levelBadgeEl) {
    const difficultyText = levelBadgeEl.textContent.trim();
    const difficultyNum = parseInt(difficultyText, 10);

    if (!isNaN(difficultyNum)) {
      if (difficultyNum < 600) {
        metadata.difficulty = 'easy';
      } else if (difficultyNum < 700) {
        metadata.difficulty = 'medium';
      } else {
        metadata.difficulty = 'hard';
      }
    }
  }

  // 4. Extract time spent from .pi-clock
  const clockIcon = document.querySelector('.pi-clock');
  if (clockIcon && clockIcon.nextElementSibling) {
    metadata.timeSpent = clockIcon.nextElementSibling.textContent.trim();
  }

  // 5. Extract correct answer (only if we haven't found it yet)
  if (!metadata.correctAnswer) {
    const correctAnswerLabel = document.querySelector('.correct-answer');
    if (correctAnswerLabel) {
      const forAttr = correctAnswerLabel.getAttribute('for');
      if (forAttr) {
        const parts = forAttr.split('-');
        metadata.correctAnswer = parts[parts.length - 1];
      }
    }
  }

  return metadata;
}

/**
 * Extract Quant question from GMAT Hero
 */
function extractGMATHeroQuantContent() {
  try {
    var rightPanel = document.getElementById('right-panel');
    if (!rightPanel) {
      console.warn("Could not find GMAT Hero right-panel element!");
      return null;
    }

    var questionStem = rightPanel.querySelector('.question-stem');
    if (!questionStem) {
      console.warn("Could not find GMAT Hero question-stem element!");
      return null;
    }

    // Extract image if exists
    var questionImage = null;
    var imgElement = questionStem.querySelector('img');
    if (imgElement) {
      // Use .src property to get absolute URL instead of .getAttribute('src')
      questionImage = imgElement.src;
    }

    var questionHTML = questionStem.innerHTML;

    // Convert KaTeX to TeX format for JSON
    var tempDiv = document.createElement("div");
    tempDiv.innerHTML = questionHTML;

    // Replace <br> tags with newline markers BEFORE processing KaTeX
    // This preserves the line structure in questions with Roman numerals
    var htmlWithLineBreaks = tempDiv.innerHTML;
    // Replace double <br> tags with double newlines (paragraph breaks)
    htmlWithLineBreaks = htmlWithLineBreaks.replace(/<br\s*\/?>/gi, '\n\n');
    // Replace single <br> tags with single newlines
    htmlWithLineBreaks = htmlWithLineBreaks.replace(/<br\s*\/?>/gi, '\n');
    tempDiv.innerHTML = htmlWithLineBreaks;

    // Extract table data BEFORE other processing (also removes table from DOM)
    var tableData = extractTable(tempDiv);

    // IMPORTANT: Escape currency symbols BEFORE processing KaTeX
    // At this point, currency like $650 is plain text, while math is in .katex elements
    escapeCurrencyInElement(tempDiv);

    // Process all Katex math expressions
    var katexElements = tempDiv.querySelectorAll(".katex");
    katexElements.forEach(function (katexElem) {
      var mathml = katexElem.querySelector(".katex-mathml");
      if (mathml) {
        var annotation = mathml.querySelector("annotation");
        if (annotation) {
          var texContent = annotation.textContent;

          // Check if this katex element is inside a katex-display wrapper
          var isDisplayMode = katexElem.closest('.katex-display') !== null;

          var isDisplay = isDisplayMode || texContent.includes("\\dfrac") || texContent.includes("\\frac") ||
            texContent.includes("\\int") || texContent.includes("\\sum");

          var mathText;
          if (isDisplayMode) {
            // Display mode: add newlines before and after for proper separation
            mathText = '\n\n$$' + texContent + '$$\n\n';
          } else if (isDisplay) {
            mathText = '$$' + texContent + '$$';
          } else {
            mathText = '$' + texContent + '$';
          }

          var mathPlaceholder = document.createTextNode(mathText);
          katexElem.replaceWith(mathPlaceholder);
        }
      }
    });

    // Get text content and clean up while preserving newlines
    var questionText = tempDiv.textContent;
    // Clean up excessive whitespace on each line but preserve newlines
    questionText = questionText.split('\n').map(function (line) {
      return line.trim();
    }).join('\n');
    // Remove excessive blank lines (more than 2 consecutive newlines)
    questionText = questionText.replace(/\n{3,}/g, '\n\n');
    questionText = questionText.trim();

    // Extract answer choices
    var answerChoices = [];
    var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');

    if (standardChoices) {
      var options = standardChoices.querySelectorAll('.option.ng-star-inserted, .option');

      options.forEach(function (option) {
        var answerText = '';

        var label = option.querySelector('label');
        if (label) {
          var katexElements = label.querySelectorAll('.katex');
          if (katexElements.length > 0) {
            var tempDiv = document.createElement("div");
            tempDiv.innerHTML = label.innerHTML;

            // Escape currency BEFORE KaTeX processing
            escapeCurrencyInElement(tempDiv);

            var katexElementsInLabel = tempDiv.querySelectorAll(".katex");
            katexElementsInLabel.forEach(function (katexElem) {
              var mathml = katexElem.querySelector(".katex-mathml");
              if (mathml) {
                var annotation = mathml.querySelector("annotation");
                if (annotation) {
                  var texContent = annotation.textContent;
                  var mathPlaceholder = document.createTextNode("$" + texContent + "$");
                  katexElem.replaceWith(mathPlaceholder);
                }
              }
            });

            answerText = tempDiv.textContent.trim();
          } else {
            var span = label.querySelector('span');
            if (span) {
              answerText = span.textContent.trim();
            } else {
              answerText = label.textContent.trim();
            }
          }
        } else {
          answerText = option.textContent.trim();
        }

        if (answerText) {
          answerText = answerText.replace(/^[A-Ea-e][\.\\)]\s*/, '').trim();
          answerChoices.push(normalizeCurrency(answerText));
        }
      });
    }

    // Extract metadata (category, difficulty, selected/correct answers, time)
    const metadata = extractGMATHeroMetadata();

    // Create JSON structure for Quant question
    var jsonData = {
      "questionLink": getPracticeUrl(),
      "source": "gmat-hero",
      "questionType": "quant",
      "difficulty": metadata.difficulty || "",
      "section": "Quant",
      "selectedAnswer": metadata.selectedAnswer || "",
      "correctAnswer": metadata.correctAnswer || "",
      "timeSpent": metadata.timeSpent || "",
      "category": metadata.category || "",
      "content": {
        "questionText": normalizeCurrency(decodeHtmlEntities(questionText)),
        "answerChoices": answerChoices,
        "image": questionImage,
        "table": tableData
      }
    };

    return jsonData;

  } catch (error) {
    console.error("Error extracting GMAT Hero Quant content:", error);
    return null;
  }
}

/**
 * Extract Critical Reasoning question from GMAT Hero
 */
function extractGMATHeroCRContent() {
  try {
    var testContent = document.getElementById('test-content');
    if (!testContent) {
      console.warn("Could not find GMAT Hero test-content element!");
      return null;
    }

    var rightPanel = testContent.querySelector('#right-panel');
    if (!rightPanel) {
      console.warn("Could not find GMAT Hero right-panel element!");
      return null;
    }

    var questionStem = rightPanel.querySelector('.question-stem');
    if (!questionStem) {
      console.warn("Could not find GMAT Hero question-stem element!");
      return null;
    }

    var stemContent = questionStem.innerHTML;

    // Extract metadata first to check question type
    const metadata = extractGMATHeroMetadata();

    // Check for boldface question: either in metadata category OR in question stem content
    var stemText = questionStem.textContent.toLowerCase();
    var isBoldfaceQuestion = (metadata.category && metadata.category.toLowerCase().includes('boldface')) ||
      stemText.includes('boldface') || stemText.includes('bold face');

    // Check for complete argument question: either in metadata OR by presence of blanks
    var isCompleteArgumentQuestion = (metadata.category && metadata.category.toLowerCase().includes('complete')) ||
      stemContent.includes('_____') || stemContent.includes('________');

    // If it's a Boldface or Complete the Argument question, convert styled spans to markdown
    if (isBoldfaceQuestion || isCompleteArgumentQuestion) {
      stemContent = convertStyledSpansToMarkdown(stemContent);
    }

    var parts = stemContent.split(/<br\s*\/?>/gi);

    var passage = "";
    var question = "";

    // Special handling for Complete the Argument questions
    // Structure: Question (with ?) comes FIRST, then <br><br>, then Passage (ending with _____)
    if (isCompleteArgumentQuestion) {
      console.log("Processing Complete the Argument question");

      // Find the first non-empty part with a question mark - that's the question
      var questionPartIndex = -1;
      var passagePartIndex = -1;

      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (part.length > 0) {
          var cleanPart = part
            .replace(/<[^>]*>/g, '')
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')
            .trim();

          if (cleanPart.includes("?") && questionPartIndex === -1) {
            questionPartIndex = i;
            question = cleanPart;
          } else if (cleanPart.includes("_____") || cleanPart.includes("________")) {
            // This is the passage/argument with blanks to complete
            passagePartIndex = i;
            passage = cleanPart;
          }
        }
      }

      // If we found both, we're done
      if (questionPartIndex >= 0 && passagePartIndex >= 0) {
        console.log("Complete Argument: Found question at index", questionPartIndex, "and passage at index", passagePartIndex);
      } else if (passagePartIndex >= 0) {
        // If we only found the passage with blanks, combine all non-blank parts as passage
        // and use a default question text
        passage = parts.filter(function (p, idx) {
          return p.trim().length > 0;
        }).map(function (p) {
          return p.replace(/<[^>]*>/g, '').replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/&amp;/g, '&').replace(/&[a-zA-Z0-9#]+;/g, '').trim();
        }).join(" ");
        question = "Which of the following most logically completes the argument?";
      } else {
        // Fallback: treat the whole stem as passage
        console.log("Complete Argument: Could not identify structure, using fallback");
        passage = stemContent.replace(/<[^>]*>/g, '').trim();
      }
    } else {
      // Original logic for standard CR questions (question at the end)
      var questionIndex = -1;
      for (var i = parts.length - 1; i >= 0; i--) {
        var part = parts[i].trim();
        if (part.length > 0) {
          var cleanPart = part
            .replace(/<[^>]*>/g, '')
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')
            .trim();

          if (cleanPart.includes("?")) {
            var lowerPart = cleanPart.toLowerCase();
            if (lowerPart.includes("which") ||
              lowerPart.includes("what") ||
              lowerPart.includes("how") ||
              lowerPart.includes("why") ||
              lowerPart.includes("except") ||
              lowerPart.includes("vulnerable") ||
              lowerPart.includes("flaw") ||
              lowerPart.includes("assumption") ||
              lowerPart.includes("conclusion") ||
              lowerPart.includes("inference") ||
              lowerPart.includes("strengthen") ||
              lowerPart.includes("weaken")) {
              questionIndex = i;
              question = cleanPart;
              break;
            }
          }
        }
      }

      if (questionIndex === -1) {
        for (var i = parts.length - 1; i >= 0; i--) {
          var part = parts[i].trim();
          if (part.length > 0) {
            var cleanPart = part
              .replace(/<[^>]*>/g, '')
              .replace(/&ldquo;/g, '"')
              .replace(/&rdquo;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&[a-zA-Z0-9#]+;/g, '')
              .trim();
            if (cleanPart.includes("?")) {
              questionIndex = i;
              question = cleanPart;
              break;
            }
          }
        }
      }

      // Edge case: Sentence-completion style questions without question mark
      // Uses shared isCompletionStyleQuestion utility
      if (questionIndex === -1) {
        for (var i = parts.length - 1; i >= 0; i--) {
          var part = parts[i].trim();
          if (part.length > 0) {
            var cleanPart = part
              .replace(/<[^>]*>/g, '')
              .replace(/&ldquo;/g, '"')
              .replace(/&rdquo;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&[a-zA-Z0-9#]+;/g, '')
              .trim();
            if (isCompletionStyleQuestion(cleanPart)) {
              questionIndex = i;
              question = cleanPart;
              console.log("Detected sentence-completion question pattern:", cleanPart);
              break;
            }
          }
        }
      }

      if (questionIndex >= 0) {
        var passageParts = parts.slice(0, questionIndex);
        passage = passageParts.join(" ").trim();
      } else {
        passage = stemContent;
      }
    }

    passage = passage
      .replace(/<[^>]*>/g, '')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    passage = decodeHtmlEntities(passage);
    question = decodeHtmlEntities(question);

    // Extract answer choices
    var answerChoices = [];
    var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');

    if (standardChoices) {
      var options = standardChoices.querySelectorAll('.option.ng-star-inserted');
      options.forEach(function (option) {
        var label = option.querySelector('label');
        if (label) {
          var span = label.querySelector('span');
          if (span) {
            var answerText = span.textContent.trim();
            if (answerText) {
              answerChoices.push(decodeHtmlEntities(answerText));
            }
          }
        }
      });
    }

    // Note: metadata was already extracted earlier to check for Boldface questions

    // Create JSON structure for CR question
    var jsonData = {
      "questionLink": getPracticeUrl(),
      "source": "",
      "questionType": "cr",
      "difficulty": metadata.difficulty || "",
      "section": "verbal",
      "selectedAnswer": metadata.selectedAnswer || "",
      "correctAnswer": metadata.correctAnswer || "",
      "timeSpent": metadata.timeSpent || "",
      "category": metadata.category || "",
      "content": {
        "passage": passage,
        "questionText": question,
        "answerChoices": answerChoices
      }
    };

    return jsonData;

  } catch (error) {
    console.error("Error extracting GMAT Hero CR content:", error);
    return null;
  }
}

/**
 * Extract Reading Comprehension question from GMAT Hero
 */
function extractGMATHeroRCContent() {
  try {
    // Extract passage from left panel
    var leftPanel = document.getElementById('left-panel');
    if (!leftPanel) {
      console.warn("Could not find GMAT Hero left-panel element!");
      return null;
    }

    var passageElement = leftPanel.querySelector('.passage');
    if (!passageElement) {
      console.warn("Could not find GMAT Hero passage element!");
      return null;
    }

    // Get passage HTML and process it
    var passageHTML = passageElement.innerHTML;

    // Convert highlighted text to markdown format first (before removing HTML tags)
    passageHTML = convertHighlightedTextToMarkdown(passageHTML);

    // Split by <br> tags (handle both single and double <br>)
    // Replace double <br> with paragraph marker, then clean up
    var passageText = passageHTML
      .replace(/<br[^>]*>\s*<br[^>]*>/gi, '\n\n') // Double breaks = paragraph breaks
      .replace(/<br[^>]*>/gi, ' ') // Single breaks = spaces
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs, but preserve newlines
      .trim();

    // Split into paragraphs and clean each one
    var paragraphs = passageText.split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Join paragraphs with double newlines
    var passage = paragraphs.join('\n');
    passage = decodeHtmlEntities(passage);

    // Extract highlight ranges and clean the passage text
    const { cleanText: cleanPassage, highlightRanges } = extractHighlightRanges(passage);
    passage = cleanPassage;

    // Extract question from right panel
    var rightPanel = document.getElementById('right-panel');
    if (!rightPanel) {
      console.warn("Could not find GMAT Hero right-panel element!");
      return null;
    }

    var questionStem = rightPanel.querySelector('.question-stem');
    if (!questionStem) {
      console.warn("Could not find GMAT Hero question-stem element!");
      return null;
    }

    // Get question HTML and convert highlighted text to markdown
    var questionHTML = questionStem.innerHTML;
    questionHTML = convertHighlightedTextToMarkdown(questionHTML);

    // Remove HTML tags and clean up
    var question = questionHTML
      .replace(/<[^>]*>/g, '')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      .trim();
    question = decodeHtmlEntities(question);

    // Extract answer choices
    var answerChoices = [];
    var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');

    if (standardChoices) {
      var options = standardChoices.querySelectorAll('.option.ng-star-inserted, .option');
      options.forEach(function (option) {
        var label = option.querySelector('label');
        if (label) {
          var span = label.querySelector('span');
          if (span) {
            var answerText = span.textContent.trim();
            if (answerText) {
              answerChoices.push(decodeHtmlEntities(answerText));
            }
          }
        }
      });
    }

    // Extract metadata (category, difficulty, selected/correct answers, time)
    const metadata = extractGMATHeroMetadata();

    // Create JSON structure for RC question
    var jsonData = {
      "questionLink": getPracticeUrl(),
      "source": "",
      "questionType": "rc",
      "difficulty": metadata.difficulty || "",
      "section": "verbal",
      "selectedAnswer": metadata.selectedAnswer || "",
      "correctAnswer": metadata.correctAnswer || "",
      "timeSpent": metadata.timeSpent || "",
      "category": metadata.category || "",
      "topic": metadata.topic || "",
      "content": {
        "passage": passage,
        "questionText": question,
        "answerChoices": answerChoices,
        "highlight_ranges": highlightRanges
      }
    };

    return jsonData;

  } catch (error) {
    console.error("Error extracting GMAT Hero RC content:", error);
    return null;
  }
}

/**
 * Main export: Extract question from GMAT Hero page
 */
export function extractGMATHeroQuestion() {
  const questionType = detectQuestionType();
  console.log("Detected GMAT Hero question type:", questionType);

  switch (questionType) {
    case 'quant':
      return extractGMATHeroQuantContent();
    case 'ds':
      // DS questions are skipped for now (or could add specific extractor)
      console.log("DS question detected - skipping");
      return null;
    case 'cr':
      return extractGMATHeroCRContent();
    case 'rc':
      return extractGMATHeroRCContent();
    case 'di-gi':
    case 'di-msr':
    case 'di-ta':
    case 'di-tpa':
      // DI questions - could add specific extractors
      console.log("DI question type detected:", questionType);
      return null;
    default:
      console.warn("Unsupported GMAT Hero question type:", questionType);
      return null;
  }
}
