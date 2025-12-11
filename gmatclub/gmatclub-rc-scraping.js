javascript: (function () {
  /**
   * Decode HTML entities
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

  function extractRCContent() {
    try {
      // Find the main item container
      let container = document.querySelector('.item.text');
      if (!container) {
        alert('No question container found.');
        return;
      }

      let clone = container.cloneNode(true);

      // Remove unwanted blocks
      clone.querySelectorAll('.twoRowsBlock, .post_signature, .spoiler').forEach(el => el.remove());

      // Find bbcodeBoxOut element
      let bbcodeBoxOut = clone.querySelector('.bbcodeBoxOut');
      if (!bbcodeBoxOut) {
        alert('No bbcodeBoxOut found.');
        return;
      }

      // Step 1: Locate the passage content
      let bbcodeBoxIns = bbcodeBoxOut.querySelectorAll('.bbcodeBoxIn');
      if (bbcodeBoxIns.length < 1) {
        alert('No bbcodeBoxIn elements found.');
        return;
      }

      // --- Passage Extraction ---
      let passageBox = bbcodeBoxIns[0];
      let passageHTML = passageBox.innerHTML;

      // Handle highlighting: <span style="background-color: #FFFF00">...</span> -> ==...==
      passageHTML = passageHTML.replace(/<span[^>]*background-color:\s*#FFFF00[^>]*>(.*?)<\/span>/gi, '==$1==');

      // Handle paragraph separation
      passageHTML = passageHTML.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n'); // Double break -> New paragraph
      passageHTML = passageHTML.replace(/<br\s*\/?>/gi, '\n'); // Single break -> Newline

      // Clean up other HTML tags but preserve the marked content
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

        // Default to first question if none explicitly visible
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
              let choiceMatch = cleanLine.match(/^([A-Ea-e])[\.\)\:]?\s*(.*)/) || cleanLine.match(/^\(([A-Ea-e])\)\s*(.*)/);
              if (choiceMatch) {
                let text = choiceMatch[2].trim();
                if (text) {
                  answerChoices.push(decodeHtmlEntities(text));
                }
              }
            }
          });
        }
      }

      // Create JSON structure matching gmatclub.js format
      let jsonData = {
        "questionLink": window.location.href,
        "source": "",
        "difficulty": "",
        "section": "verbal",
        "selectedAnswer": "",
        "correctAnswer": "",
        "timeSpent": "",
        "category": "",
        "content": {
          "passage": passageText,
          "questionText": questionText,
          "answerChoices": answerChoices,
          "highlight_ranges": highlightRanges
        }
      };

      // Create overlay
      let overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '5%';
      overlay.style.left = '5%';
      overlay.style.width = '90%';
      overlay.style.height = '90%';
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
        <h2 style="margin-bottom: 15px; color: #333;">Reading Comprehension Question JSON</h2>
        <pre id="bookmarklet-json" style="background: #f4f4f4; padding: 15px; border-left: 4px solid #333; white-space: pre-wrap; word-wrap: break-word; margin-bottom: 20px;">${JSON.stringify(jsonData, null, 2)}</pre>
        <button id="bookmarklet-copy" style="margin-top:20px;padding:10px 15px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Copy to Clipboard</button>
        <button id="bookmarklet-close" style="margin-top:20px;margin-left:10px;padding:10px 15px;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Close</button>
      `;

      document.body.appendChild(overlay);

      // Close button
      document.getElementById("bookmarklet-close").onclick = () => overlay.remove();

      // Copy button
      document.getElementById("bookmarklet-copy").onclick = () => {
        let copyText = JSON.stringify(jsonData, null, 2);
        navigator.clipboard.writeText(copyText).then(() => {
          let btn = document.getElementById("bookmarklet-copy");
          let originalText = btn.innerText;
          btn.innerText = "Copied!";
          btn.style.background = "#4CAF50";
          setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "#2196F3";
          }, 2000);
        }).catch(err => {
          alert("Copy failed: " + err);
        });
      };

    } catch (error) {
      alert("Error occurred: " + error.message);
    }
  }

  extractRCContent();
})();
