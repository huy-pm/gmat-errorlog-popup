import { getPracticeUrl } from '../utils.js';

/**
 * GMAT Logger Modular - GMATClub Extractor
 * Extracts questions from gmatclub.com forum pages
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
 * If updating, also update: utils.js, gmatOG.js, gmathero.js, gmat-og/*.js, gmat-hero/*.js, gmatclub/*.js
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
 * Process boldface text - convert <strong>text</strong> and <span style="font-weight: bold">text</span> to **text**
 */
function processBoldface(html) {
  // Handle <strong> tags
  let result = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  // Handle <span style="font-weight: bold">text</span>
  result = result.replace(/<span[^>]*font-weight:\s*bold[^>]*>(.*?)<\/span>/gi, '**$1**');
  return result;
}

/**
 * Clean trash content from GMATClub posts (signatures, dividers, excessive whitespace)
 */
function cleanTrashContent(text) {
  let result = text
    // Remove underscore dividers (commonly used as separators)
    .replace(/_+/g, '')
    // Remove excessive whitespace (tabs, multiple spaces, multiple newlines)
    .replace(/[\t\r]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/\s{2,}/g, ' ')
    // Trim leading/trailing whitespace
    .trim();
  return result;
}

/**
 * Difficulty mapping: GMATClub tag_id -> difficulty level
 */
const DIFFICULTY_MAPPING = {
  "1518": "Easy",  // Sub 505 Level
  "227": "Easy",   // 505-555 Level
  "226": "Medium",   // 555-605 Level
  "1525": "Medium", // 605-655 Level
  "168": "Hard",   // 655-705 Level
  "1532": "Hard",  // 705-805 Level
  "1539": "Hard"   // 805+ Level
};

/**
 * Category mapping: GMATClub tag_id -> system category
 */
const CATEGORY_MAPPING = {
  "115": "Assumption",
  "119": "Boldface",
  "203": "Complete Argument",
  "116": "Other",
  "171": "Other",
  "207": "Evaluate",
  "120": "Inference",
  "201": "Flaw",
  "121": "Inference",
  "247": "Other",
  "486": "Other",
  "1236": "Other",
  "123": "Paradox",
  "202": "Other",
  "118": "Strengthen",
  "117": "Weaken",
  "2073": "Other",
  "2074": "Other"
};

/**
 * Extract time spent from GMATClub timer
 */
function extractTimeSpent() {
  const timerDisplay = document.querySelector('#timer_display.time');
  if (!timerDisplay) {
    return "";
  }

  const timeText = timerDisplay.textContent.trim();
  console.log('[GMATClub] Extracted time spent:', timeText);
  return timeText;
}

/**
 * Extract selected and correct answers from GMATClub statistics
 */
function extractAnswerStatistics() {
  const timerDiv = document.querySelector('.buttons');
  if (!timerDiv) {
    return { selectedAnswer: "", correctAnswer: "" };
  }

  let selectedAnswer = "";
  let correctAnswer = "";

  // Find selected answer
  const selectedWrap = timerDiv.querySelector('.statisticWrap.selectedAnswer');
  if (selectedWrap) {
    const answerType = selectedWrap.querySelector('.answerType');
    if (answerType) {
      selectedAnswer = answerType.textContent.trim().toUpperCase();
    }
  }

  // Find correct answer
  const correctWrap = timerDiv.querySelector('.statisticWrap.correctAnswer');
  if (correctWrap) {
    const answerType = correctWrap.querySelector('.answerType');
    if (answerType) {
      correctAnswer = answerType.textContent.trim().toUpperCase();
    }
  }

  return { selectedAnswer, correctAnswer };
}

/**
 * Extract metadata from History table (Time, Selected Answer, Correct Answer)
 */
function extractHistoryMetadata() {
  const historyTable = document.querySelector('.historyTable');
  if (!historyTable) {
    return { timeSpent: "", selectedAnswer: "", correctAnswer: "" };
  }

  const rows = historyTable.querySelectorAll('.historyTableRow');
  if (rows.length === 0) {
    return { timeSpent: "", selectedAnswer: "", correctAnswer: "" };
  }

  // Get the last row (latest attempt)
  const lastRow = rows[rows.length - 1];

  // Extract Time
  const timeDiv = lastRow.querySelector('.time');
  const timeSpent = timeDiv ? timeDiv.textContent.trim() : "";

  // Extract Answers
  let selectedAnswer = "";
  let correctAnswer = "";

  const answersPopup = lastRow.querySelector('.answersPopup');
  if (answersPopup) {
    const rows = answersPopup.querySelectorAll('.answersPopupRow');
    rows.forEach(row => {
      const text = row.textContent.trim();
      if (text.includes("My Answer:")) {
        const span = row.querySelector('span');
        if (span) selectedAnswer = span.textContent.trim();
      } else if (text.includes("Correct Answer:")) {
        const span = row.querySelector('span');
        if (span) correctAnswer = span.textContent.trim();
      }
    });
  }

  return { timeSpent, selectedAnswer, correctAnswer };
}

/**
 * Extract tag IDs from GMATClub page and map to difficulty and category
 */
function extractTagsFromPage() {
  const tagList = document.querySelector('#taglist');
  if (!tagList) {
    return { difficulty: "", category: "" };
  }

  const tagLinks = tagList.querySelectorAll('a.tag_css_link');
  let difficulty = "";
  let category = "";

  tagLinks.forEach(link => {
    const tagId = link.getAttribute('data-title') || link.href.match(/tag_id=(\d+)/)?.[1];
    if (tagId) {
      // Check if it's a difficulty tag
      if (DIFFICULTY_MAPPING[tagId] && !difficulty) {
        difficulty = DIFFICULTY_MAPPING[tagId];
      }
      // Check if it's a category tag
      if (CATEGORY_MAPPING[tagId] && !category) {
        category = CATEGORY_MAPPING[tagId];
      }
    }
  });

  return { difficulty, category };
}

/**
 * Detect GMAT section from GMATClub page DOM
 */
function detectGMATClubSection() {
  let section = "Unknown";

  // First try: Check taglist for section tag IDs
  const tagList = document.querySelector('#taglist');
  if (tagList) {
    const tagLinks = tagList.querySelectorAll('a.tag_css_link');
    for (const link of tagLinks) {
      const tagId = link.href.match(/tag_id=(\d+)/)?.[1];
      if (tagId) {
        if (tagId === "1015") {
          section = "Quant";
          return section;
        } else if (tagId === "101" || tagId === "1017") {
          section = "Critical Reasoning";
          return section;
        } else if (tagId === "1018") {
          section = "Reading";
          return section;
        }
      }
    }
  }

  // Second try: Check forum links in DOM (fallback method)
  const td = document.querySelector('td a[href*="/forum/"]')?.closest('td');
  if (td) {
    if (td.querySelector('a[href*="quantitative-questions-7"]'))
      section = "Quant";
    else if (td.querySelector('a[href*="critical-reasoning-cr-139"]'))
      section = "Critical Reasoning";
    else if (td.querySelector('a[href*="reading-comprehension-rc-137"]'))
      section = "Reading";
    else if (td.querySelector('a[href*="data-insights-questions-177"]'))
      section = "Data Insights";
  }

  return section;
}

/**
 * Extract Quant question from GMATClub
 */
function extractGMATClubQuantContent() {
  let container = document.querySelector('.item.text');
  if (!container) {
    console.warn('No GMATClub question container found.');
    return null;
  }
  let clone = container.cloneNode(true);

  // Remove unwanted blocks
  clone.querySelectorAll('.twoRowsBlock, .post_signature, .spoiler').forEach(el => el.remove());

  // Remove existing MathJax rendered HTML but preserve the script tags with math content
  clone.querySelectorAll('.MathJax_Preview, .mjx-chtml, .MJX_Assistive_MathML, .MathJax, .MathJax_Display').forEach(el => el.remove());

  // Replace TeX scripts with proper delimiters for MathJax
  clone.querySelectorAll('script[type="math/tex"]').forEach(script => {
    let tex = script.textContent.trim();
    let span = document.createElement('span');
    // Check if it's display math based on parent or script attributes
    if (script.parentElement.classList.contains('MathJax_Display') ||
      script.getAttribute("mode") === "display" ||
      script.type.includes("display")) {
      span.textContent = "$$" + tex + "$$";   // block math
    } else {
      span.textContent = "$" + tex + "$";   // inline math
    }
    script.parentNode.replaceChild(span, script);
  });

  // Convert the clone to HTML string for easier manipulation
  let htmlContent = clone.innerHTML;

  // Find the first answer choice to split question from answers
  let answerStartIndex = -1;
  let firstAnswerLetter = '';

  // Patterns to match answer choices: (A), A., A), etc.
  let patterns = [
    /\(\s*[A-E]\s*\)/,  // (A), (B), etc.
    /[A-E]\s*\./,       // A., B., etc.
    /[A-E]\s*\)/,       // A), B), etc.
  ];

  for (let pattern of patterns) {
    let match = htmlContent.match(pattern);
    if (match) {
      answerStartIndex = match.index;
      firstAnswerLetter = match[0].match(/[A-E]/)[0];
      break;
    }
  }

  let questionHTML = '';
  let answersHTML = '';

  if (answerStartIndex !== -1) {
    // Split content into question and answers
    questionHTML = htmlContent.substring(0, answerStartIndex).trim();
    let answersPart = htmlContent.substring(answerStartIndex).trim();

    // Extract all answer choices
    let answerChoices = [];
    let answerRegex = /(?:(?:\(\s*([A-E])\s*\))|(?:([A-E])\s*\.?)|(?:([A-E])\s*\)))/g;
    let match;
    let lastMatchEnd = 0;

    while ((match = answerRegex.exec(answersPart)) !== null) {
      let letter = match[1] || match[2] || match[3];
      if (letter) {
        if (answerChoices.length > 0) {
          answerChoices[answerChoices.length - 1].content = answersPart.substring(lastMatchEnd, match.index).trim();
        }
        answerChoices.push({ letter: letter, content: '' });
        lastMatchEnd = match.index + match[0].length;
      }
    }

    if (answerChoices.length > 0) {
      answerChoices[answerChoices.length - 1].content = answersPart.substring(lastMatchEnd).trim();
    }

    // Create JSON structure for Quant question
    let jsonData = {
      "questionLink": "",
      "source": "",
      "questionType": "quant",
      "difficulty": "",
      "section": "Quant",
      "category": "Problem Solving",
      "content": {
        "questionText": cleanTrashContent(decodeHtmlEntities(questionHTML.replace(/<[^>]*>/g, ''))),
        "answerChoices": answerChoices.map(choice =>
          cleanTrashContent(decodeHtmlEntities(choice.content.replace(/<[^>]*>/g, '').trim()))
        ).filter(choice => choice.length > 0) // Filter out empty choices after cleanup
      }
    };

    return jsonData;
  } else {
    // Fallback: if we can't find answer choices
    questionHTML = htmlContent;

    let jsonData = {
      "questionLink": "",
      "source": "",
      "questionType": "quant",
      "difficulty": "",
      "section": "Quant",
      "category": "Problem Solving",
      "content": {
        "questionText": cleanTrashContent(decodeHtmlEntities(questionHTML.replace(/<[^>]*>/g, ''))),
        "answerChoices": []
      }
    };

    return jsonData;
  }
}

/**
 * Extract Critical Reasoning question from GMATClub
 */
function extractGMATClubCRContent() {
  try {
    var e = document.querySelector('.post-wrapper.first-post');
    if (!e) {
      console.warn("Could not find GMATClub first post wrapper!");
      return null;
    }

    var t = e.querySelector('.post-info.add-bookmark');
    if (!t) {
      console.warn("Could not find GMATClub post-info add-bookmark section!");
      return null;
    }

    var n = t.querySelector('.item.text');
    if (!n) {
      console.warn("Could not find GMATClub item text div!");
      return null;
    }

    var o = n.cloneNode(true);
    o.querySelectorAll('.item.twoRowsBlock,.post_signature').forEach(function (e) {
      e.remove();
    });

    var h = o.innerHTML.replace(/\r?\n|\r/g, "");

    // Apply boldface processing before extracting content
    h = processBoldface(h);

    // Find where answer choices begin
    var answerSectionStart = -1;
    var answerPatterns = [
      "<br><br>\\(",
      "<br><br>[A-Za-z][.:;)/]",
      "<br><br>[A-Za-z]\\s",
      "<br><br>&lt;[A-Za-z]&gt;",
      "<br><br><ul>",
      "<ul>\\([A-Za-z]\\)"
    ];

    for (var i = 0; i < answerPatterns.length; i++) {
      var pattern = new RegExp(answerPatterns[i]);
      var match = h.search(pattern);
      if (match !== -1 && (answerSectionStart === -1 || match < answerSectionStart)) {
        answerSectionStart = match;
      }
    }

    var questionHTML = '';
    var answersHTML = '';

    if (answerSectionStart !== -1) {
      questionHTML = h.substring(0, answerSectionStart).trim();
      var answersPart = h.substring(answerSectionStart).trim();

      // Clean up <ul> tags if present in the answer section
      answersPart = answersPart.replace(/<\/?ul>/g, "");

      var answerLines = answersPart.split("<br>");
      var answerChoices = [];

      var answerRegex = /^\([A-Za-z]\)|^[A-Za-z][.:;)/]?|^([A-Za-z])\s+|^&lt;[A-Za-z]&gt;/;

      for (var i = 0; i < answerLines.length; i++) {
        var line = answerLines[i].trim();
        if (line.length > 0 && answerRegex.test(line)) {
          answerChoices.push(line);
        }
      }

      answersHTML = answerChoices.map(function (choice) {
        return choice
          .replace(/^\(([A-Za-z])\)/, '$1.')
          .replace(/^([A-Za-z])[:;)/]/, '$1.')
          .replace(/^&lt;([A-Za-z])&gt;/, '$1.')
          .replace(/^([A-Za-z])\.\s+/, '$1. ')
          .replace(/^([A-Za-z])\s+/, '$1. ')
          .replace(/^([A-Za-z])(\s+|$)/, '$1. ');
      }).join("<br>");
    } else {
      questionHTML = h;
      answersHTML = "";
    }

    // Extract passage and question
    var passage = "";
    var question = "";

    var parts = questionHTML.split("<br>");
    var questionIndex = -1;

    for (var i = parts.length - 1; i >= 0; i--) {
      var part = parts[i].trim();
      if (part.length === 0) continue;

      if ((part.includes("?") && (part.toLowerCase().includes("which") ||
        part.toLowerCase().includes("what") ||
        part.toLowerCase().includes("how") ||
        part.toLowerCase().includes("why") ||
        part.toLowerCase().includes("except:")))) {
        questionIndex = i;
        question = part;
        break;
      }
    }

    if (questionIndex === -1) {
      for (var i = parts.length - 1; i >= 0; i--) {
        var part = parts[i].trim();
        if (part.length > 0 && part.includes("?")) {
          questionIndex = i;
          question = part;
          break;
        }
      }
    }

    // Edge case: Sentence-completion style questions without question mark
    // Uses shared isCompletionStyleQuestion utility
    if (questionIndex === -1) {
      for (var i = parts.length - 1; i >= 0; i--) {
        var part = parts[i].trim();
        if (part.length > 0 && isCompletionStyleQuestion(part)) {
          questionIndex = i;
          question = part;
          console.log("Detected sentence-completion question pattern:", part);
          break;
        }
      }
    }

    if (questionIndex >= 0) {
      var passageParts = parts.slice(0, questionIndex);
      passage = passageParts.join(" ").trim();
    } else {
      passage = questionHTML;
    }

    // Clean up
    passage = passage
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      .trim();

    passage = decodeHtmlEntities(passage);

    question = question
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      .trim();

    question = decodeHtmlEntities(question);

    var cleanAnswers = answersHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      .trim();

    cleanAnswers = decodeHtmlEntities(cleanAnswers);

    // Parse answer choices into array
    var answerChoicesArray = [];

    var answerLines = cleanAnswers.split("\n");
    answerLines.forEach(function (line) {
      var match = line.match(/^([A-E])\.\s*(.*)/);
      if (match) {
        answerChoicesArray.push(match[2].trim());
      }
    });

    // Create JSON structure for CR question
    var jsonData = {
      "questionLink": "",
      "source": "",
      "questionType": "cr",
      "difficulty": "",
      "section": "verbal",
      "content": {
        "passage": passage,
        "questionText": question,
        "answerChoices": answerChoicesArray
        // Note: category will be added from tag extraction if available
      }
    };

    return jsonData;

  } catch (s) {
    console.error("Error extracting GMATClub CR content:", s);
    return null;
  }
}

/**
 * Extract Reading Comprehension question from GMATClub
 */
function extractGMATClubRCContent() {
  try {
    // Gather metadata first
    const tags = extractTagsFromPage();
    const historyMetadata = extractHistoryMetadata();
    const answerStats = extractAnswerStatistics(); // Fallback if history is empty?

    // Prioritize history metadata, fallback to answerStats/tags
    const metadata = {
      difficulty: tags.difficulty,
      category: tags.category,
      timeSpent: historyMetadata.timeSpent || extractTimeSpent(),
      selectedAnswer: historyMetadata.selectedAnswer || answerStats.selectedAnswer,
      correctAnswer: historyMetadata.correctAnswer || answerStats.correctAnswer
    };

    let container = document.querySelector('.item.text');
    if (!container) {
      console.warn('No GMATClub RC container found.');
      return null;
    }

    let clone = container.cloneNode(true);
    clone.querySelectorAll('.twoRowsBlock, .post_signature, .spoiler').forEach(el => el.remove());

    let bbcodeBoxOut = clone.querySelector('.bbcodeBoxOut');
    if (!bbcodeBoxOut) {
      console.warn('No bbcodeBoxOut found.');
      return null;
    }

    let bbcodeBoxIns = bbcodeBoxOut.querySelectorAll('.bbcodeBoxIn');
    if (bbcodeBoxIns.length < 1) {
      console.warn('No bbcodeBoxIn elements found.');
      return null;
    }

    // --- Passage Extraction ---
    let passageBox = bbcodeBoxIns[0];
    let passageHTML = passageBox.innerHTML;

    // Handle highlighting: <span style="background-color: #FFFF00">...</span> -> ==...==
    passageHTML = passageHTML.replace(/<span[^>]*background-color:\s*#FFFF00[^>]*>(.*?)<\/span>/gi, '==$1==');

    // Handle paragraph separation
    passageHTML = passageHTML.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n'); // Double break -> New paragraph
    passageHTML = passageHTML.replace(/<br\s*\/?>/gi, '\n'); // Single break -> Newline

    let passageText = passageHTML.replace(/<[^>]*>/g, '');
    passageText = decodeHtmlEntities(passageText).trim();

    // Extract highlight ranges and clean the passage text
    const { cleanText: cleanPassage, highlightRanges } = extractHighlightRanges(passageText);
    passageText = cleanPassage;

    // --- Question Extraction ---
    let questionText = "";
    let answerChoices = [];

    if (bbcodeBoxIns.length >= 2) {
      let questionsBox = bbcodeBoxIns[1];
      let questionWrappers = questionsBox.querySelectorAll('.question_wrapper');

      // Find the visible question
      let visibleWrapper = null;
      for (const wrapper of questionWrappers) {
        if (wrapper.style.display !== 'none') {
          visibleWrapper = wrapper;
          break;
        }
      }

      // Default to first question if none explicitly visible (or all hidden/shown?)
      if (!visibleWrapper && questionWrappers.length > 0) {
        visibleWrapper = questionWrappers[0];
      }

      if (visibleWrapper) {
        let wrapperClone = visibleWrapper.cloneNode(true);

        // Extract Question Text
        let questionSpan = wrapperClone.querySelector('span[style*="font-weight: bold"]');

        if (questionSpan) {
          questionText = questionSpan.textContent.trim();
          // Remove leading number (e.g., "1. ")
          questionText = questionText.replace(/^\d+\.\s*/, '');
        } else {
          // Fallback: take first line
          questionText = wrapperClone.textContent.trim().split('\n')[0] || '';
          questionText = questionText.replace(/^\d+\.\s*/, '');
        }
        questionText = decodeHtmlEntities(questionText);

        // Extract Answer Choices
        let choicesHTML = '';
        if (questionSpan && questionSpan.outerHTML) {
          // Get content after the question span
          let wrapperHTML = visibleWrapper.innerHTML;
          let spanEndIndex = wrapperHTML.indexOf(questionSpan.outerHTML) + questionSpan.outerHTML.length;
          choicesHTML = wrapperHTML.substring(spanEndIndex);
        } else {
          // Fallback: use whole wrapper
          choicesHTML = visibleWrapper.innerHTML;
        }

        choicesHTML = choicesHTML.replace(/<br\s*\/?>/gi, '\n');
        let choicesText = choicesHTML.replace(/<[^>]*>/g, '');
        choicesText = decodeHtmlEntities(choicesText);

        let lines = choicesText.split('\n');
        lines.forEach(line => {
          let cleanLine = line.trim();
          if (cleanLine) {
            // Match (A), A., A), etc.
            let choiceMatch = cleanLine.match(/^([A-Ea-e])[\.\)\:]\s*(.*)/) || cleanLine.match(/^\(([A-Ea-e])\)\s*(.*)/);
            if (choiceMatch) {
              // let letter = choiceMatch[1].toUpperCase(); // Not strictly needed for array but good for debug
              let text = choiceMatch[2].trim();
              if (text) {
                answerChoices.push(decodeHtmlEntities(text));
              }
            }
          }
        });
      }
    }

    // Create JSON structure for RC question
    var jsonData = {
      "questionLink": getPracticeUrl(window.location.href),
      "source": "", // Will be filled by enrich or caller if needed, but usually empty here
      "questionType": "rc",
      "difficulty": metadata.difficulty || "",
      "section": "verbal",
      "selectedAnswer": metadata.selectedAnswer || "",
      "correctAnswer": metadata.correctAnswer || "",
      "timeSpent": metadata.timeSpent || "",
      "category": metadata.category || "",
      "content": {
        "passage": passageText,
        "questionText": questionText,
        "answerChoices": answerChoices,
        "highlight_ranges": highlightRanges
      }
    };

    return jsonData;

  } catch (error) {
    console.error("Error extracting GMATClub RC content:", error);
    return null;
  }
}

/**
 * Main export: Extract question from GMATClub page
 */
export function extractGMATClubQuestion() {
  const section = detectGMATClubSection();
  console.log("Detected GMATClub section:", section);

  // Extract tags (difficulty and category) from the page
  const tags = extractTagsFromPage();
  console.log("Extracted tags:", tags);

  // Extract answer statistics (selected and correct answers)
  const answerStats = extractAnswerStatistics();
  console.log("Extracted answer statistics:", answerStats);

  // Extract time spent
  const timeSpent = extractTimeSpent();
  console.log("Extracted time spent:", timeSpent);

  let questionData = null;

  switch (section) {
    case "Quant":
      questionData = extractGMATClubQuantContent();
      break;
    case "Critical Reasoning":
      questionData = extractGMATClubCRContent();
      break;
    case "Reading":
      questionData = extractGMATClubRCContent();
      break;
    default:
      console.warn("Unsupported GMATClub question type:", section);
      return null;
  }

  // Merge extracted tags, answer statistics, and time spent into the question data
  // Note: RC extraction now handles this internally, but we keep this for other sections
  // and to ensure consistency if RC extraction missed something (though RC returns full object now)
  if (questionData) {
    // Only set difficulty if successfully extracted and not already present
    if (tags.difficulty && !questionData.difficulty) {
      questionData.difficulty = tags.difficulty;
    }
    // Only set category if successfully extracted (for CR questions only, RC handles it)
    if (tags.category && section === "Critical Reasoning") {
      questionData.category = tags.category;
    }

    // Add selected and correct answers if not present
    if (answerStats.selectedAnswer && !questionData.selectedAnswer) {
      questionData.selectedAnswer = answerStats.selectedAnswer;
    }
    if (answerStats.correctAnswer && !questionData.correctAnswer) {
      questionData.correctAnswer = answerStats.correctAnswer;
    }
    // Add time spent if not present
    if (timeSpent && !questionData.timeSpent) {
      questionData.timeSpent = timeSpent;
    }
  }

  return questionData;
}
