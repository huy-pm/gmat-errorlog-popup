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
      "question_link": "",
      "source": "",
      "difficulty": "",
      "section": "Quant",
      "content": {
        "question_text": decodeHtmlEntities(questionHTML.replace(/<[^>]*>/g, '')),
        "answer_choices": answerChoices.map(choice =>
          decodeHtmlEntities(choice.content.replace(/<[^>]*>/g, '').trim())
        ),
        "correct_answer": "",
        "category": "Problem Solving"
      }
    };

    return jsonData;
  } else {
    // Fallback: if we can't find answer choices
    questionHTML = htmlContent;

    let jsonData = {
      "question_link": "",
      "source": "",
      "difficulty": "",
      "section": "Quant",
      "content": {
        "question_text": decodeHtmlEntities(questionHTML.replace(/<[^>]*>/g, '')),
        "answer_choices": [],
        "correct_answer": "",
        "category": "Problem Solving"
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
      "question_link": "",
      "source": "",
      "difficulty": "",
      "section": "CR",
      "content": {
        "passage": passage,
        "question_text": question,
        "answer_choices": answerChoicesArray,
        "correct_answer": ""
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
    let container = document.querySelector('.item.text');
    if (!container) {
      console.warn('No GMATClub RC container found.');
      return null;
    }

    let clone = container.cloneNode(true);
    clone.querySelectorAll('.twoRowsBlock, .post_signature, .spoiler').forEach(el => el.remove());

    let htmlContent = clone.innerHTML;
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

    let passageBox = bbcodeBoxIns[0];
    let passageHTML = passageBox.innerHTML;

    passageHTML = passageHTML.replace(/<br\s*\/?>/gi, '\n');
    passageHTML = passageHTML.replace(/<span[^>]*>(.*?)<\/span>/gi, '**$1**');

    let passageText = passageHTML.replace(/<[^>]*>/g, '');
    passageText = decodeHtmlEntities(passageText);

    let questions = [];

    if (bbcodeBoxIns.length >= 2) {
      let questionsBox = bbcodeBoxIns[1];
      let questionWrappers = questionsBox.querySelectorAll('.question_wrapper');

      questionWrappers.forEach((wrapper, index) => {
        try {
          let wrapperClone = wrapper.cloneNode(true);

          let questionSpan = wrapperClone.querySelector('span[style*="font-weight: bold"]');
          let questionText = '';

          if (questionSpan) {
            questionText = questionSpan.textContent.trim();
            questionText = questionText.replace(/^\d+\.\s*/, '');
          } else {
            questionText = wrapperClone.textContent.trim().split('\n')[0] || '';
            questionText = questionText.replace(/^\d+\.\s*/, '');
          }

          questionText = decodeHtmlEntities(questionText);

          let choices = {};
          let wrapperHTML = wrapper.innerHTML;

          let choicesHTML = '';
          if (questionSpan && questionSpan.outerHTML) {
            let spanEndIndex = wrapperHTML.indexOf(questionSpan.outerHTML) + questionSpan.outerHTML.length;
            choicesHTML = wrapperHTML.substring(spanEndIndex);
          } else {
            choicesHTML = wrapperHTML;
            if (questionSpan && questionSpan.outerHTML) {
              choicesHTML = choicesHTML.replace(questionSpan.outerHTML, '');
            }
          }

          choicesHTML = choicesHTML.replace(/<br\s*\/?>/gi, '\n');
          let choicesText = choicesHTML.replace(/<[^>]*>/g, '');
          choicesText = decodeHtmlEntities(choicesText);

          let lines = choicesText.split('\n');

          lines.forEach(line => {
            let cleanLine = line.trim();
            if (cleanLine) {
              let choiceMatch = cleanLine.match(/^([A-Ea-e])[.)]\s*(.*)/);
              if (choiceMatch) {
                let letter = choiceMatch[1].toUpperCase();
                let text = choiceMatch[2].trim();
                if (text) {
                  choices[letter] = decodeHtmlEntities(text);
                }
              }
            }
          });

          if (questionText) {
            questions.push({
              question_text: questionText,
              choices: choices
            });
          }
        } catch (e) {
          console.error('Error processing question wrapper ' + index + ':', e);
        }
      });
    }

    // Create structured questions array
    let structuredQuestions = [];
    questions.forEach(q => {
      let choicesArray = [];
      let letters = ["A", "B", "C", "D", "E"];
      letters.forEach(letter => {
        if (q.choices[letter]) {
          choicesArray.push(decodeHtmlEntities(q.choices[letter]));
        }
      });

      let structuredQuestion = {
        "question_text": decodeHtmlEntities(q.question_text),
        "answer_choices": choicesArray,
        "correct_answer": ""
      };
      structuredQuestions.push(structuredQuestion);
    });

    // Create JSON structure for RC question
    let jsonData = {
      "question_link": "",
      "source": "",
      "difficulty": "",
      "section": "RC",
      "content": {
        "passage_title": "",
        "passage_text": passageText,
        "questions": structuredQuestions
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

  // Merge extracted tags into the question data
  if (questionData) {
    // Only set difficulty if successfully extracted
    if (tags.difficulty) {
      questionData.difficulty = tags.difficulty;
    }
    // Only set category if successfully extracted (for CR questions only)
    if (tags.category && section === "Critical Reasoning") {
      questionData.content.category = tags.category;
    }
    // If category wasn't extracted, don't set any default - focus on text content only
  }

  return questionData;
}
