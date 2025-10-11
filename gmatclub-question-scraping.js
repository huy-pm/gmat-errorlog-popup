javascript:(function() {
  // Function to detect the GMAT section
  function detectSection() {
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

  // Function to extract Quant questions
  function extractQuantContent() {
    let container = document.querySelector('.item.text');
    if (!container) {
      alert('No question container found.');
      return;
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
    // Look for any pattern that starts with a letter in parentheses or followed by a period
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
        let letter = match[1] || match[2] || match[3]; // Get the letter from any of the capture groups
        if (letter) {
          if (answerChoices.length > 0) {
            // Set the content for the previous answer choice
            answerChoices[answerChoices.length - 1].content = answersPart.substring(lastMatchEnd, match.index).trim();
          }
          // Add new answer choice
          answerChoices.push({letter: letter, content: ''});
          lastMatchEnd = match.index + match[0].length;
        }
      }
      
      // Set content for the last answer choice
      if (answerChoices.length > 0) {
        answerChoices[answerChoices.length - 1].content = answersPart.substring(lastMatchEnd).trim();
      }
      
      // Format answers for display - ALWAYS in format "A. [Answer choice]"
      answersHTML = answerChoices.map(choice => `${choice.letter}. ${choice.content}`).join("<br>");
    } else {
      // Fallback: if we can't find answer choices, treat everything as question
      questionHTML = htmlContent;
      answersHTML = "No answer choices found";
    }
    
    // Create overlay
    let overlay = document.createElement('div');
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
      <h2 style="margin-bottom: 15px;">Question</h2>
      <div id="bookmarklet-question" style="margin-bottom: 20px; line-height: 1.6;">${questionHTML}</div>
      <h2 style="margin-bottom: 15px;">Answer Choices</h2>
      <div id="bookmarklet-answers" style="line-height: 1.8;">${answersHTML}</div>
      <button id="bookmarklet-copy" style="margin-top:20px;padding:8px 15px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;">Copy to Clipboard</button>
      <button id="bookmarklet-close" style="margin-top:20px;margin-left:10px;padding:8px 15px;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;">Close</button>
    `;
    
    document.body.appendChild(overlay);
    
    // Close button
    document.getElementById("bookmarklet-close").onclick = () => overlay.remove();
    
    // Copy button
    document.getElementById("bookmarklet-copy").onclick = () => {
      let copyText = "Question:\n" + questionHTML.replace(/<[^>]*>/g, '') + "\n\nAnswer Choices:\n" + answersHTML.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
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
    
    // Configure and load MathJax
    function configureMathJax() {
      window.MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true,
          processEnvironments: true
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
          ignoreHtmlClass: 'tex2jax_ignore',
          processHtmlClass: 'tex2jax_process'
        }
      };
    }
    
    // Typeset the overlay content with MathJax
    function typesetOverlay() {
      if (window.MathJax && window.MathJax.typeset) {
        MathJax.typeset([overlay]);
        console.log('Math typesetting complete');
      } else if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise([overlay]).then(() => {
          console.log('Math typesetting complete');
        }).catch(err => {
          console.error('MathJax typesetting error:', err);
        });
      }
    }
    
    // Check if MathJax is loaded
    if (typeof MathJax === "undefined" || !MathJax.typeset) {
      // Configure MathJax before loading
      configureMathJax();
      
      // Load MathJax 3
      let script = document.createElement("script");
      script.type = "text/javascript";
      script.id = "MathJax-script";
      script.async = true;
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      script.onload = function() {
        // Wait a bit for MathJax to initialize, then typeset
        setTimeout(typesetOverlay, 1000);
      };
      document.head.appendChild(script);
    } else {
      // MathJax already loaded, just typeset
      console.log('MathJax already loaded, typesetting...');
      setTimeout(typesetOverlay, 500);
    }
  }

  // Function to extract Critical Reasoning questions
  function extractCRContent() {
    try {
      var e = document.querySelector('.post-wrapper.first-post');
      if (!e) {
        alert("Could not find the first post wrapper!");
        return;
      }
      
      var t = e.querySelector('.post-info.add-bookmark');
      if (!t) {
        alert("Could not find the post-info add-bookmark section!");
        return;
      }
      
      var n = t.querySelector('.item.text');
      if (!n) {
        alert("Could not find the item text div!");
        return;
      }
      
      var o = n.cloneNode(true);
      o.querySelectorAll('.item.twoRowsBlock,.post_signature').forEach(function(e) {
        e.remove();
      });
      
      var h = o.innerHTML.replace(/\r?\n|\r/g, "");
      
      // Find where answer choices begin - look for multiple patterns
      // More comprehensive pattern matching for answer sections
      var answerSectionStart = -1;
      var answerPatterns = [
        "<br><br>\\(", // For (A) format
        "<br><br>[A-Za-z][.:;)/]", // For A., A), A:, A;, A/, A) formats (both uppercase and lowercase)
        "<br><br>[A-Za-z]\\s", // For A followed by space
        "<br><br>&lt;[A-Za-z]&gt;" // For <A> format
      ];
      
      // Try to find the first occurrence of any answer pattern
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
        // Split content at the answer choices
        questionHTML = h.substring(0, answerSectionStart).trim();
        var answersPart = h.substring(answerSectionStart).trim();
        
        // Extract answer choices by splitting on <br> and filtering
        var answerLines = answersPart.split("<br>");
        var answerChoices = [];
        
        // More comprehensive regex for answer detection
        // Matches: (A), (a), A., a., A), a), A:, a:, A;, a;, A/, a/, A, a followed by space or content
        var answerRegex = /^\([A-Za-z]\)|^[A-Za-z][.:;)/]?|^([A-Za-z])\s+|^&lt;[A-Za-z]&gt;/;
        
        for (var i = 0; i < answerLines.length; i++) {
          var line = answerLines[i].trim();
          // Check for answer patterns with more comprehensive regex
          if (line.length > 0 && answerRegex.test(line)) {
            answerChoices.push(line);
          }
        }
        
        // Format answers for display - ALWAYS in format "A. [Answer choice]"
        answersHTML = answerChoices.map(function(choice) {
          // Comprehensive conversion to standard A. format
          return choice
            // Convert (A) format to A.
            .replace(/^\(([A-Za-z])\)/, '$1.')
            // Convert A:, a:, A;, a;, A/, a/, A), a) formats to A.
            .replace(/^([A-Za-z])[:;)/]/, '$1.')
            // Convert <A> format to A.
            .replace(/^&lt;([A-Za-z])&gt;/, '$1.')
            // Convert A.    (with extra spaces) to A. (single space)
            .replace(/^([A-Za-z])\.\s+/, '$1. ')
            // Ensure there's a period after the letter if missing
            .replace(/^([A-Za-z])\s+/, '$1. ')
            // Fallback for any remaining formats
            .replace(/^([A-Za-z])(\s+|$)/, '$1. ');
        }).join("<br>");
      } else {
        // Fallback: if we can't find answer choices, treat everything as question
        questionHTML = h;
        answersHTML = "No answer choices found";
      }
      
      // Extract passage and question
      var passage = "";
      var question = "";
      
      // Robust approach: Split by <br> and intelligently identify the question
      var parts = questionHTML.split("<br>");
      var questionIndex = -1;
      
      // Look for the question part - it's typically the last meaningful part with a question mark
      // or contains key question words
      for (var i = parts.length - 1; i >= 0; i--) {
        var part = parts[i].trim();
        // Skip empty parts
        if (part.length === 0) continue;
        
        // Look for question patterns
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
      
      // Fallback: if we didn't find a specific pattern, look for any text ending with ?
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
        // Build passage from parts before the question
        var passageParts = parts.slice(0, questionIndex);
        passage = passageParts.join(" ").trim();
      } else {
        // If no question found, treat everything as passage
        passage = questionHTML;
      }
      
      // Clean up passage - remove HTML tags and normalize
      passage = passage
        .replace(/<br\s*\/?>/gi, '\n')          // Convert <br> to newlines
        .replace(/<[^>]*>/g, '')                 // Remove HTML tags
        .replace(/&ldquo;/g, '"')                // Convert HTML entities
        .replace(/&rdquo;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
        .trim();
      
      // Clean up question
      question = question
        .replace(/<br\s*\/?>/gi, ' ')            // Convert <br> to spaces
        .replace(/<[^>]*>/g, '')                 // Remove HTML tags
        .replace(/&ldquo;/g, '"')                // Convert HTML entities
        .replace(/&rdquo;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
        .trim();
      
      // Clean up answers
      var cleanAnswers = answersHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&[a-zA-Z0-9#]+;/g, '')
        .trim();
      
      // Create popup window
      var popup = window.open("", "Extracted Data", "width=800,height=700,scrollbars=yes");
      popup.document.write(
        '<html>' +
        '<head>' +
          '<title>Extracted Data</title>' +
          '<style>' +
            'body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }' +
            'h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; }' +
            'pre { background: #f4f4f4; padding: 15px; border-left: 4px solid #333; white-space: pre-wrap; word-wrap: break-word; }' +
            '.section { margin-bottom: 30px; }' +
            'button { padding: 10px 15px; margin: 5px; background-color: #2196F3; color: white; border: none; cursor: pointer; }' +
            'button:hover { background-color: #0b7dda; }' +
          '</style>' +
        '</head>' +
        '<body>' +
          '<button onclick="copyToClipboard()">Copy to Clipboard</button>' +
          '<div class="section">' +
            '<h2>Passage</h2>' +
            '<pre id="passage">' + passage + '</pre>' +
          '</div>' +
          '<div class="section">' +
            '<h2>Question</h2>' +
            '<pre id="question">' + question + '</pre>' +
          '</div>' +
          '<div class="section">' +
            '<h2>Answer Choices</h2>' +
            '<pre id="answers">' + cleanAnswers + '</pre>' +
          '</div>' +
          '<script>' +
            'function copyToClipboard() {' +
              'var passage = document.getElementById("passage").textContent;' +
              'var question = document.getElementById("question").textContent;' +
              'var answers = document.getElementById("answers").textContent;' +
              'var content = passage + "\\n\\n" + question + "\\n\\n" + answers;' +
              'navigator.clipboard.writeText(content).then(function() {' +
                'showToast("Content copied to clipboard");' +
              '}).catch(function(err) {' +
                'console.error("Failed to copy: ", err);' +
                'showToast("Failed to copy content to clipboard");' +
              '});' +
            '}' +
            'function showToast(message) {' +
              'var toast = document.createElement("div");' +
              'toast.textContent = message;' +
              'toast.style.cssText = "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); " +' +
                '"background-color: #333; color: white; padding: 16px; border-radius: 4px; " +' +
                '"z-index: 1000; font-family: Arial, sans-serif; font-size: 16px; " +' +
                '"box-shadow: 0 2px 8px rgba(0,0,0,0.2); opacity: 0; transition: opacity 0.3s;";' +
              'document.body.appendChild(toast);' +
              'setTimeout(function() {' +
                'toast.style.opacity = "1";' +
              '}, 100);' +
              'setTimeout(function() {' +
                'toast.style.opacity = "0";' +
                'setTimeout(function() {' +
                  'document.body.removeChild(toast);' +
                '}, 300);' +
              '}, 3000);' +
            '}' +
          '</script>' +
        '</body>' +
        '</html>'
      );
      
    } catch (s) {
      alert("Error occurred: " + (s.message || s));
    }
  }

  // Function to extract Reading Comprehension questions
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
      
      // Convert the clone to HTML string for easier manipulation
      let htmlContent = clone.innerHTML;
      
      // Find bbcodeBoxOut element
      let bbcodeBoxOut = clone.querySelector('.bbcodeBoxOut');
      if (!bbcodeBoxOut) {
        alert('No bbcodeBoxOut found.');
        return;
      }
      
      // Step 1: Locate the passage content
      // Find the first bbcodeBoxIn within bbcodeBoxOut
      let bbcodeBoxIns = bbcodeBoxOut.querySelectorAll('.bbcodeBoxIn');
      if (bbcodeBoxIns.length < 1) {
        alert('No bbcodeBoxIn elements found.');
        return;
      }
      
      let passageBox = bbcodeBoxIns[0];
      let passageHTML = passageBox.innerHTML;
      
      // Process passage content
      // Convert <br> tags to newlines
      passageHTML = passageHTML.replace(/<br\s*\/?>/gi, '\n');
      
      // Find <span> tags and enclose their content with ** markers
      passageHTML = passageHTML.replace(/<span[^>]*>(.*?)<\/span>/gi, '**$1**');
      
      // Clean up other HTML tags but preserve the marked content
      let passageText = passageHTML.replace(/<[^>]*>/g, '');
      
      // Step 2: Locate and extract questions and answers
      let questions = [];
      
      if (bbcodeBoxIns.length >= 2) {
        let questionsBox = bbcodeBoxIns[1];
        let questionWrappers = questionsBox.querySelectorAll('.question_wrapper');
        
        questionWrappers.forEach((wrapper, index) => {
          try {
            // Clone the wrapper to avoid modifying the original
            let wrapperClone = wrapper.cloneNode(true);
            
            // Find question text in <span> tags with style="font-weight: bold"
            let questionSpan = wrapperClone.querySelector('span[style*="font-weight: bold"]');
            let questionText = '';
            
            if (questionSpan) {
              questionText = questionSpan.textContent.trim();
              // Remove the question number prefix (e.g., "1. ")
              questionText = questionText.replace(/^\d+\.\s*/, '');
            } else {
              // Fallback: try to get text content
              questionText = wrapperClone.textContent.trim().split('\n')[0] || '';
              // Remove the question number prefix if present
              questionText = questionText.replace(/^\d+\.\s*/, '');
            }
            
            // Find answer choices by parsing the content after the question
            let choices = {};
            
            // Get the HTML content of the wrapper
            let wrapperHTML = wrapper.innerHTML;
            
            // Extract content after the question span
            let choicesHTML = '';
            if (questionSpan && questionSpan.outerHTML) {
              let spanEndIndex = wrapperHTML.indexOf(questionSpan.outerHTML) + questionSpan.outerHTML.length;
              choicesHTML = wrapperHTML.substring(spanEndIndex);
            } else {
              // Fallback to all content after removing the first span if it exists
              choicesHTML = wrapperHTML;
              if (questionSpan && questionSpan.outerHTML) {
                choicesHTML = choicesHTML.replace(questionSpan.outerHTML, '');
              }
            }
            
            // Parse answer choices from the HTML
            // Convert <br> tags to newlines for easier parsing
            choicesHTML = choicesHTML.replace(/<br\s*\/?>/gi, '\n');
            // Remove all other HTML tags
            let choicesText = choicesHTML.replace(/<[^>]*>/g, '');
            
            // Split by newlines and parse each line
            let lines = choicesText.split('\n');
            
            lines.forEach(line => {
              let cleanLine = line.trim();
              if (cleanLine) {
                // Check if this line starts with a letter and period/dot
                let choiceMatch = cleanLine.match(/^([A-Ea-e])[.)]\s*(.*)/);
                if (choiceMatch) {
                  let letter = choiceMatch[1].toUpperCase();
                  let text = choiceMatch[2].trim();
                  if (text) {
                    choices[letter] = text;
                  }
                }
              }
            });
            
            // Only add question if we have text
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
      
      // Step 3: Compile and format the final output
      let outputData = {
        passage: passageText,
        questions: questions
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
      
      // Format the output for display
      // Highlight text enclosed in ** with yellow background
      let formattedPassage = passageText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<span style="background-color: yellow;">$1</span>');
      let formattedQuestions = '';
      
      questions.forEach((q, index) => {
        formattedQuestions += `<h3>Question ${index + 1}</h3>`;
        formattedQuestions += `<p><strong>${q.question_text}</strong></p>`;
        for (let letter in q.choices) {
          formattedQuestions += `<div><strong>${letter}</strong> ${q.choices[letter]}</div>`;
        }
        formattedQuestions += '<br>';
      });
      
      overlay.innerHTML = `
        <h2 style="margin-bottom: 15px; color: #333;">Reading Comprehension Passage and Questions</h2>
        <div style="margin-bottom: 20px;">
          <h3>Passage</h3>
          <div style="padding: 15px; border-left: 4px solid #3498db; margin-bottom: 20px; line-height: 1.6;">
            ${formattedPassage}
          </div>
        </div>
        <div style="margin-bottom: 20px;">
          <h3>Questions</h3>
          <div style="line-height: 1.8;">
            ${formattedQuestions || 'No questions found.'}
          </div>
        </div>
        <button id="bookmarklet-copy" style="margin-top:20px;padding:10px 15px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Copy to Clipboard</button>
        <button id="bookmarklet-close" style="margin-top:20px;margin-left:10px;padding:10px 15px;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Close</button>
      `;
      
      document.body.appendChild(overlay);
      
      // Close button
      document.getElementById("bookmarklet-close").onclick = () => overlay.remove();
      
      // Copy button
      document.getElementById("bookmarklet-copy").onclick = () => {
        // Format data for copying
        let copyText = "Passage:\n" + passageText + "\n\nQuestions:\n";
        questions.forEach((q, index) => {
          copyText += `\n${index + 1}. ${q.question_text}\n`;
          for (let letter in q.choices) {
            copyText += `   ${letter} ${q.choices[letter]}\n`;
          }
        });
        
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

  // Main execution
  try {
    const section = detectSection();
    // Removed alert for detected question type
    
    switch (section) {
      case "Quant":
        extractQuantContent();
        break;
      case "Critical Reasoning":
        extractCRContent();
        break;
      case "Reading":
        extractRCContent();
        break;
      default:
        alert("Unsupported question type or unable to detect section.");
        break;
    }
  } catch (error) {
    alert("Error occurred: " + error.message);
  }
})();