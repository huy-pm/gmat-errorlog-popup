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
 * Convert styled spans to markdown format for boldface questions
 * - Italicized spans (font-style: italic) -> *text*
 * - Bold spans or default -> **text**
 */
function convertStyledSpansToMarkdown(htmlContent) {
  var result = htmlContent;
  result = result.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, function (match, content) {
    if (match.includes('font-style: italic') || match.includes('font-style:italic')) {
      return '*' + content + '*';
    }
    return '**' + content + '**';
  });
  return result;
}

/**
 * Convert highlighted text to markdown format for RC questions
 * - Yellow background spans -> ==text==
 */
function convertHighlightedTextToMarkdown(htmlContent) {
  var result = htmlContent.replace(
    /<span\s+style="[^"]*background-color:\s*yellow[^"]*">([^<]*)<\/span>/gi,
    '==$1=='
  );
  return result;
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
 * Detect GMAT section from GMAT Hero page based on HTML structure
 * This is more stable than URL-based detection as it reflects actual page content
 */
function detectGMATHeroSection() {
  // RC: Has left panel with passage element
  const leftPanel = document.getElementById('left-panel');
  const passageEl = leftPanel?.querySelector('.passage');
  if (passageEl) {
    return "Reading Comprehension";
  }

  // Quant: Has KaTeX math elements in the question
  const rightPanel = document.getElementById('right-panel');
  const hasMath = rightPanel?.querySelector('.katex');
  if (hasMath) {
    return "Quant";
  }

  // Default to CR for verbal questions without passage
  const questionStem = rightPanel?.querySelector('.question-stem');
  if (questionStem) {
    return "Critical Reasoning";
  }

  return "Unknown";
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

    var questionHTML = questionStem.innerHTML;

    // Convert KaTeX to TeX format for JSON
    var tempDiv = document.createElement("div");
    tempDiv.innerHTML = questionHTML;

    // Process all Katex math expressions
    var katexElements = tempDiv.querySelectorAll(".katex");
    katexElements.forEach(function (katexElem) {
      var mathml = katexElem.querySelector(".katex-mathml");
      if (mathml) {
        var annotation = mathml.querySelector("annotation");
        if (annotation) {
          var texContent = annotation.textContent;
          var isDisplay = texContent.includes("\\dfrac") || texContent.includes("\\frac") ||
            texContent.includes("\\int") || texContent.includes("\\sum");
          var mathPlaceholder = document.createTextNode(isDisplay ? "$$" + texContent + "$$" : "$" + texContent + "$");
          katexElem.replaceWith(mathPlaceholder);
        }
      }
    });

    var questionText = tempDiv.textContent.trim();

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
          answerText = answerText.replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
          answerChoices.push(answerText);
        }
      });
    }

    // Extract metadata (category, difficulty, selected/correct answers, time)
    const metadata = extractGMATHeroMetadata();

    // Create JSON structure for Quant question
    var jsonData = {
      "questionLink": getPracticeUrl(),
      "source": "",
      "questionType": "quant",
      "difficulty": metadata.difficulty || "",
      "section": "Quant",
      "selectedAnswer": metadata.selectedAnswer || "",
      "correctAnswer": metadata.correctAnswer || "",
      "timeSpent": metadata.timeSpent || "",
      "category": metadata.category || "",
      "content": {
        "questionText": decodeHtmlEntities(questionText),
        "answerChoices": answerChoices
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
    var isBoldfaceQuestion = metadata.category && metadata.category.toLowerCase().includes('boldface');
    var isCompleteArgumentQuestion = metadata.category && metadata.category.toLowerCase().includes('complete');

    // Also detect Complete Argument questions by content pattern (underscore blanks)
    // This handles cases where metadata doesn't explicitly indicate the question type
    if (!isCompleteArgumentQuestion && (stemContent.includes('_____') || stemContent.includes('________'))) {
      console.log("Detected Complete Argument question by content pattern (underscores)");
      isCompleteArgumentQuestion = true;
    }

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
  const section = detectGMATHeroSection();
  console.log("Detected GMAT Hero section:", section);

  switch (section) {
    case "Quant":
      return extractGMATHeroQuantContent();
    case "Critical Reasoning":
      return extractGMATHeroCRContent();
    case "Reading Comprehension":
      return extractGMATHeroRCContent();
    default:
      console.warn("Unsupported GMAT Hero question type:", section);
      return null;
  }
}
