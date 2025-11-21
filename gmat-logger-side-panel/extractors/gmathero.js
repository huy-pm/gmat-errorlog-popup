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
 * Detect GMAT section from GMAT Hero page URL
 */
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
        "category": ""
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
        "correct_answer": ""
        // Note: category left empty - focus on text content only
      }
    };

    return jsonData;

  } catch (error) {
    console.error("Error extracting GMAT Hero CR content:", error);
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
    default:
      console.warn("Unsupported GMAT Hero question type:", section);
      return null;
  }
}
