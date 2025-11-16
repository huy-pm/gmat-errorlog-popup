/**
 * GMAT Error Log Bookmarklet with Question Extraction - GitHub Hosted Version
 * Usage: javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/huy-pm/gmat-errorlog@main/gmat-logger-bookmarklet-with-question.js';document.head.appendChild(s);})();
 */
(function() {
  'use strict';

  const CONFIG = {
    apiUrl: 'https://gmat-errorlog.vercel.app',
    devUrl: 'http://localhost:5001',
    version: '2.0.0' // Add question extraction feature
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

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Function to decode HTML entities
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
    } catch (error) { console.warn('Invalid URL format:', url); }
    return undefined;
  }

  // Detect which question source we're on
  function detectQuestionSource(url) {
    if (!url) return null;
    if (url.includes('gmatclub.com')) {
      return 'gmatclub';
    } else if (url.includes('gmat-hero-v2.web.app')) {
      return 'gmathero';
    }
    return null;
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

  // ============================================================================
  // GMATCLUB EXTRACTION FUNCTIONS
  // ============================================================================

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
          answerChoices.push({letter: letter, content: ''});
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
          "category": ""
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
      o.querySelectorAll('.item.twoRowsBlock,.post_signature').forEach(function(e) {
        e.remove();
      });

      var h = o.innerHTML.replace(/\r?\n|\r/g, "");

      // Find where answer choices begin
      var answerSectionStart = -1;
      var answerPatterns = [
        "<br><br>\\(",
        "<br><br>[A-Za-z][.:;)/]",
        "<br><br>[A-Za-z]\\s",
        "<br><br>&lt;[A-Za-z]&gt;"
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

        var answerLines = answersPart.split("<br>");
        var answerChoices = [];

        var answerRegex = /^\([A-Za-z]\)|^[A-Za-z][.:;)/]?|^([A-Za-z])\s+|^&lt;[A-Za-z]&gt;/;

        for (var i = 0; i < answerLines.length; i++) {
          var line = answerLines[i].trim();
          if (line.length > 0 && answerRegex.test(line)) {
            answerChoices.push(line);
          }
        }

        answersHTML = answerChoices.map(function(choice) {
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
      answerLines.forEach(function(line) {
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
          "correct_answer": "",
          "category": "Assumption"
        }
      };

      return jsonData;

    } catch (s) {
      console.error("Error extracting GMATClub CR content:", s);
      return null;
    }
  }

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

  function extractGMATClubQuestion() {
    const section = detectGMATClubSection();
    console.log("Detected GMATClub section:", section);

    switch (section) {
      case "Quant":
        return extractGMATClubQuantContent();
      case "Critical Reasoning":
        return extractGMATClubCRContent();
      case "Reading":
        return extractGMATClubRCContent();
      default:
        console.warn("Unsupported GMATClub question type:", section);
        return null;
    }
  }

  // ============================================================================
  // GMAT HERO EXTRACTION FUNCTIONS
  // ============================================================================

  function detectGMATHeroSection() {
    let section = "Unknown";

    // First priority: Check the current page URL
    const url = window.location.href.toLowerCase();
    if (url.includes('quant') || url.includes('rq')) {
      section = "Quant";
      return section;
    } else if (url.includes('cr') || url.includes('rcr')) {
      section = "Critical Reasoning";
      return section;
    }

    // Fallback: Look for href attributes in the page
    const links = document.querySelectorAll('a[href]');

    for (let link of links) {
      const href = link.getAttribute('href').toLowerCase();

      if (href.includes('quant') || href.includes('rq')) {
        section = "Quant";
        break;
      }
      else if (href.includes('cr') || href.includes('rcr')) {
        section = "Critical Reasoning";
        break;
      }
    }

    return section;
  }

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
      katexElements.forEach(function(katexElem) {
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

        options.forEach(function(option) {
          var answerText = '';

          var label = option.querySelector('label');
          if (label) {
            var katexElements = label.querySelectorAll('.katex');
            if (katexElements.length > 0) {
              var tempDiv = document.createElement("div");
              tempDiv.innerHTML = label.innerHTML;

              var katexElementsInLabel = tempDiv.querySelectorAll(".katex");
              katexElementsInLabel.forEach(function(katexElem) {
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

      // Create JSON structure for Quant question
      var jsonData = {
        "question_link": "",
        "source": "",
        "difficulty": "",
        "section": "Quant",
        "content": {
          "question_text": decodeHtmlEntities(questionText),
          "answer_choices": answerChoices,
          "correct_answer": "",
          "category": "Problem Solving"
        }
      };

      return jsonData;

    } catch (error) {
      console.error("Error extracting GMAT Hero Quant content:", error);
      return null;
    }
  }

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
      var parts = stemContent.split(/<br\s*\/?>/gi);

      var passage = "";
      var question = "";

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

      if (questionIndex >= 0) {
        var passageParts = parts.slice(0, questionIndex);
        passage = passageParts.join(" ").trim();
      } else {
        passage = stemContent;
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
        options.forEach(function(option) {
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

      // Create JSON structure for CR question
      var jsonData = {
        "question_link": "",
        "source": "",
        "difficulty": "",
        "section": "CR",
        "content": {
          "passage": passage,
          "question_text": question,
          "answer_choices": answerChoices,
          "correct_answer": "",
          "category": "Assumption"
        }
      };

      return jsonData;

    } catch (error) {
      console.error("Error extracting GMAT Hero CR content:", error);
      return null;
    }
  }

  function extractGMATHeroQuestion() {
    const section = detectGMATHeroSection();
    console.log("Detected GMAT Hero section:", section);

    switch (section) {
      case "Quant":
        return extractGMATHeroQuantContent();
      case "Critical Reasoning":
        return extractGMATHeroCRContent();
      default:
        console.warn("Unsupported GMAT Hero question type:", section);
        return null;
    }
  }

  // ============================================================================
  // UNIFIED EXTRACTION FUNCTIONS
  // ============================================================================

  async function extractquestionData(questionLink) {
    const source = detectQuestionSource(questionLink);
    console.log("Detected question source:", source);

    if (source === 'gmatclub') {
      return extractGMATClubQuestion();
    } else if (source === 'gmathero') {
      return extractGMATHeroQuestion();
    }

    console.warn("Unable to detect question source from URL:", questionLink);
    return null;
  }

  function enrichquestionData(questionData, payload) {
    if (!questionData) return null;

    // Map bookmarklet data to question JSON
    questionData.question_link = payload.question || questionData.question_link;
    questionData.difficulty = payload.difficulty || questionData.difficulty;
    questionData.source = payload.source || questionData.source;

    // Map category to category (if content exists)
    if (questionData.content && payload.category) {
      questionData.content.category = payload.category;
    }

    return questionData;
  }

  // ============================================================================
  // AUTOCOMPLETE AND SUGGESTION FUNCTIONS
  // ============================================================================

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
  // UI FUNCTIONS
  // ============================================================================

  async function createModal() {
    await fetchCategories();
    const existingModal = document.getElementById('gmat-logger-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'gmat-logger-modal';
    modal.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><div style="background:white;border-radius:12px;width:90%;max-width:500px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);max-height:90vh;overflow-y:auto;"><div style="padding:24px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="margin:0;font-size:20px;font-weight:600;color:#1f2937">⚡ Quick Log (with Question Extract)</h2><button id="gmat-logger-close" style="background:none;border:none;font-size:24px;cursor:pointer;padding:4px;color:#6b7280">×</button></div><form id="gmat-logger-form" style="display:flex;flex-direction:column;"><div style="margin-bottom:16px"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px">Question Link</label><input id="gmat-question-link" type="url" placeholder="https://gmatclub.com/forum/..." style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box"/></div><div style="margin-bottom:16px"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px">Smart Notes</label><div style="position:relative"><textarea id="gmat-notes" placeholder="Type: weaken hard - my mistake was..." style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;min-height:80px;max-height:200px;font-family:inherit;box-sizing:border-box"></textarea><div id="gmat-suggestions" style="position:absolute;z-index:10;width:100%;margin-top:1px;background:white;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:none"></div></div><p style="font-size:12px;color:#6b7280;margin-top:4px;margin-bottom:0">Type keywords: <code style="background:#f3f4f6;padding:1px 4px;border-radius:3px">weaken</code>, <code style="background:#f3f4f6;padding:1px 4px;border-radius:3px">hard</code> and press Tab to complete.</p></div><div style="margin-bottom:16px"><div id="gmat-tags-container" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div><div id="gmat-tags-section" style="margin-top:8px"><div style="display:flex;justify-content:flex-start;margin-bottom:4px"><button type="button" id="gmat-toggle-tags" style="background:none;border:none;color:#3b82f6;font-size:12px;cursor:pointer;padding:0">See all</button></div><div id="gmat-tags-list" style="display:flex;flex-wrap:wrap;gap:4px;max-height:150px;overflow-y:auto"></div><div id="gmat-tags-expanded" style="display:none;flex-wrap:wrap;gap:4px;max-height:200px;overflow-y:auto"></div></div></div><div id="gmat-parsed-preview" style="background:rgba(156,163,175,0.1);padding:16px;border-radius:8px;margin-bottom:16px;display:none"><h4 style="font-weight:500;font-size:14px;color:#6b7280;margin:0 0 8px 0">Parsed Information:</h4><div id="gmat-parsed-badges" style="display:flex;flex-wrap:wrap;gap:8px"></div><p id="gmat-parsed-notes" style="font-size:12px;color:#6b7280;margin:8px 0 0 0;display:none;max-height:200px;overflow-y:auto"></p></div><div style="padding:16px 0 0 0;border-top:1px solid #e5e7eb;display:flex;gap:12px;justify-content:flex-end;"><button type="button" id="gmat-logger-cancel" style="padding:8px 16px;border:1px solid #d1d5db;background:white;color:#374151;border-radius:6px;font-size:14px;cursor:pointer">Cancel</button><button type="submit" id="gmat-logger-submit" style="padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:500">Quick Add</button></div></form><div id="gmat-logger-status" style="margin-top:16px;padding:12px;border-radius:6px;font-size:14px;display:none"></div></div></div></div>`;

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
          console.log('Bookmarklet: Removing tag at index:', index, 'tag:', tag);
          tags.splice(index, 1);
          renderTags();
        });
        tagsContainer.appendChild(tagElement);
      });
      console.log('Bookmarklet: Current tags in state:', tags);
    }

    function addTag(tag) {
      const trimmedTag = tag.trim();
      if (trimmedTag && !tags.includes(trimmedTag)) {
        tags.push(trimmedTag);
        renderTags();
        console.log('Bookmarklet: Added tag:', trimmedTag, 'Current tags:', tags);
      } else {
        console.log('Bookmarklet: Skipped adding tag (empty or duplicate):', trimmedTag);
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

    // Get tags from the DOM
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
      tags: tags
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Extracting...';

    try {
      // NEW: Extract question JSON
      console.log('Attempting to extract question from page...');
      const questionData = await extractquestionData(questionLink);

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

  function showStatus(message, type) {
    const statusDiv = document.getElementById('gmat-logger-status');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    const styles = { success: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }, error: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }, default: { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' } };
    const style = styles[type] || styles.default;
    Object.assign(statusDiv.style, style);
  }

  console.log('⚡ GMAT Quick Log Bookmarklet with Question Extraction v' + CONFIG.version);
  createModal();
})();
