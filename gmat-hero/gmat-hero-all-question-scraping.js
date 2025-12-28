javascript: (function () {
  // Function to decode HTML entities
  function decodeHtmlEntities(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  }

  // Convert styled spans to markdown format for boldface questions
  // - Italicized spans (font-style: italic) -> *text*
  // - Bold spans or default -> **text**
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

  // Function to detect the GMAT section
  function detectSection() {
    let section = "Unknown";

    // First priority: Check the current page URL (most reliable)
    const url = window.location.href.toLowerCase();
    if (url.includes('quant') || url.includes('rq')) {
      section = "Quant";
      return section;
    } else if (url.includes('cr') || url.includes('rcr')) {
      section = "Critical Reasoning";
      return section;
    }

    // Fallback: Look for href attributes in the page if URL check didn't work
    const links = document.querySelectorAll('a[href]');

    for (let link of links) {
      const href = link.getAttribute('href').toLowerCase();

      // Check for Quant indicators
      if (href.includes('quant') || href.includes('RQ')) {
        section = "Quant";
        break;
      }
      // Check for CR indicators
      else if (href.includes('CR') || href.includes('RCR')) {
        section = "Critical Reasoning";
        break;
      }
    }

    // Fallback: Check URL if no matching links found
    if (section === "Unknown") {
      const url = window.location.href.toLowerCase();
      if (url.includes('quant') || url.includes('rq')) {
        section = "Quant";

      } else if (url.includes('cr') || url.includes('rcr')) {
        section = "Critical Reasoning";
      }
    }

    return section;
  }

  // Function to extract Quant questions
  function extractQuantContent() {
    try {
      // Find the right panel
      var rightPanel = document.getElementById('right-panel');
      if (!rightPanel) {
        alert("Could not find the right-panel element!");
        return;
      }

      // Extract question from question-stem
      var questionStem = rightPanel.querySelector('.question-stem');
      if (!questionStem) {
        alert("Could not find the question-stem element!");
        return;
      }

      // Get the innerHTML which contains the KaTeX math expressions
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
            // Determine if display or inline math
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

          // Look for label with span containing katex
          var label = option.querySelector('label');
          if (label) {
            // Check if label contains katex elements
            var katexElements = label.querySelectorAll('.katex');
            if (katexElements.length > 0) {
              // Extract math content from katex elements
              var tempDiv = document.createElement("div");
              tempDiv.innerHTML = label.innerHTML;

              // Process all Katex math expressions
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
              // Fallback to regular text extraction
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
            // Clean up the answer text
            answerText = answerText.replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
            answerChoices.push(answerText);
          }
        });
      }

      // Create JSON structure for Quant question
      var jsonData = {
        "question_link": "",
        "source": "gmat-hero",
        "difficulty": "",
        "type": "Quant",
        "questionType": "quant",
        "content": {
          "question_text": decodeHtmlEntities(questionText),
          "answer_choices": answerChoices,
          "correct_answer": "",
          "subtype": "Problem Solving"
        }
      };

      // Display the JSON in an overlay
      displayJSONOverlay(jsonData, "Quant Question JSON");

    } catch (error) {
      alert("Error occurred: " + (error.message || error));
    }
  }

  // Function to extract Critical Reasoning questions
  function extractCRContent() {
    try {
      // Find the main content container
      var testContent = document.getElementById('test-content');
      if (!testContent) {
        alert("Could not find the test-content element!");
        return;
      }

      // Find the right panel
      var rightPanel = testContent.querySelector('#right-panel');
      if (!rightPanel) {
        alert("Could not find the right-panel element!");
        return;
      }

      // Extract passage and question from question-stem
      var questionStem = rightPanel.querySelector('.question-stem');
      if (!questionStem) {
        alert("Could not find the question-stem element!");
        return;
      }

      // Get all content from question-stem
      var stemContent = questionStem.innerHTML;

      // Apply boldface processing before extracting content
      stemContent = convertStyledSpansToMarkdown(stemContent);

      // Split by <br> tags to separate passage from question
      var parts = stemContent.split(/<br\s*\/?>/gi);

      var passage = "";
      var question = "";

      // Find the question - look for specific question patterns
      var questionIndex = -1;
      for (var i = parts.length - 1; i >= 0; i--) {
        var part = parts[i].trim();
        if (part.length > 0) {
          // Look for common question patterns in CR questions
          var cleanPart = part
            .replace(/<[^>]*>/g, '')                 // Remove HTML tags
            .replace(/&ldquo;/g, '"')                // Convert HTML entities
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
            .trim();

          // Check for typical CR question patterns
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

      // Fallback: if we didn't find a specific pattern, look for any text ending with ?
      if (questionIndex === -1) {
        for (var i = parts.length - 1; i >= 0; i--) {
          var part = parts[i].trim();
          if (part.length > 0) {
            var cleanPart = part
              .replace(/<[^>]*>/g, '')                 // Remove HTML tags
              .replace(/&ldquo;/g, '"')                // Convert HTML entities
              .replace(/&rdquo;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
              .trim();
            if (cleanPart.includes("?")) {
              questionIndex = i;
              question = cleanPart;
              break;
            }
          }
        }
      }

      // Build passage from parts before the question
      if (questionIndex >= 0) {
        var passageParts = parts.slice(0, questionIndex);
        passage = passageParts.join(" ").trim();
      } else {
        // If no question found, treat everything as passage
        passage = stemContent;
      }

      // Clean up passage
      passage = passage
        .replace(/<[^>]*>/g, '')                 // Remove HTML tags
        .replace(/&ldquo;/g, '"')                // Convert HTML entities
        .replace(/&rdquo;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
        .replace(/\s+/g, ' ')                   // Normalize whitespace
        .trim();

      // Apply HTML entity decoding
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
        "source": "gmat-hero",
        "difficulty": "",
        "type": "CR",
        "questionType": "cr",
        "content": {
          "passage": passage,
          "question_text": question,
          "answer_choices": answerChoices,
          "correct_answer": "",
          "subtype": "Assumption"
        }
      };

      // Display the JSON in an overlay
      displayJSONOverlay(jsonData, "Critical Reasoning Question JSON");

    } catch (error) {
      alert("Error occurred: " + (error.message || error));
    }
  }

  // Function to display JSON in an overlay
  function displayJSONOverlay(jsonData, title) {
    // Create overlay with JSON display
    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '8%';
    overlay.style.left = '8%';
    overlay.style.width = '84%';
    overlay.style.height = '84%';
    overlay.style.background = 'white';
    overlay.style.color = 'black';
    overlay.style.overflow = 'auto';
    overlay.style.zIndex = 999999;
    overlay.style.padding = '20px';
    overlay.style.border = '2px solid black';
    overlay.style.borderRadius = '8px';
    overlay.style.boxShadow = '0 0 15px rgba(0,0,0,0.3)';
    overlay.style.fontFamily = 'Arial, sans-serif';
    overlay.innerHTML = `
      <h2 style="margin-bottom: 15px;">${title}</h2>
      <pre id="bookmarklet-json" style="background: #f4f4f4; padding: 15px; border-left: 4px solid #333; white-space: pre-wrap; word-wrap: break-word; margin-bottom: 20px;">${JSON.stringify(jsonData, null, 2)}</pre>
      <button id="bookmarklet-copy" style="margin-top:20px;padding:8px 15px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;">Copy to Clipboard</button>
      <button id="bookmarklet-close" style="margin-top:20px;margin-left:10px;padding:8px 15px;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;">Close</button>
    `;

    document.body.appendChild(overlay);
    console.log(JSON.stringify(jsonData, null, 2));

    // Close button
    document.getElementById("bookmarklet-close").onclick = () => overlay.remove();

    // Copy button
    document.getElementById("bookmarklet-copy").onclick = () => {
      let copyText = JSON.stringify(jsonData, null, 2);
      navigator.clipboard.writeText(copyText).then(() => {
        let btn = document.getElementById("bookmarklet-copy");
        let originalText = btn.innerText;
        btn.innerText = "Copied!";
        btn.style.background = "#8BC34A";
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.background = "#4CAF50";
        }, 2000);
      }).catch(err => {
        alert("Copy failed: " + err);
      });
    };
  }

  // Main execution
  try {
    const section = detectSection();
    console.log("Detected section:", section);

    switch (section) {
      case "Quant":
        extractQuantContent();
        break;
      case "Critical Reasoning":
        extractCRContent();
        break;
      default:
        alert("Unsupported question type or unable to detect section. Please ensure the URL contains 'quant', 'RQ', 'CR', or 'RCR'.");
        break;
    }
  } catch (error) {
    alert("Error occurred: " + error.message);
  }
})();
