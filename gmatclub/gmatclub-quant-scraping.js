javascript:(function() {
  function extractContent() {
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
    
    // Improved answer choice extraction logic
    // First, try to find a clear separator between question and answers
    let answerStartIndex = -1;
    
    // Look for common separators that typically come before answer choices
    let separators = [
      '<br><br>',  // Double line break
      '<br/>\\s*<br/>',  // XHTML double line break
      '\\n\\s*\\n'   // Double newline
    ];
    
    for (let separator of separators) {
      let regex = new RegExp(separator, 'i');
      let match = htmlContent.match(regex);
      if (match) {
        // Look for answer choices after this separator
        let afterSeparator = htmlContent.substring(match.index + match[0].length);
        if (hasValidAnswerChoices(afterSeparator)) {
          answerStartIndex = match.index + match[0].length;
          break;
        }
      }
    }
    
    // If we didn't find a separator, try to find answer choices directly
    if (answerStartIndex === -1) {
      // Look for a block that contains consecutive answer choices
      answerStartIndex = findAnswerBlockStart(htmlContent);
    }
    
    let questionHTML = '';
    let answersHTML = '';
    
    if (answerStartIndex !== -1) {
      // Split content into question and answers
      questionHTML = htmlContent.substring(0, answerStartIndex).trim();
      let answersPart = htmlContent.substring(answerStartIndex).trim();
      
      // Extract all answer choices using improved logic
      let answerChoices = extractAnswerChoices(answersPart);
      
      // Format answers for display
      answersHTML = answerChoices.map(choice => `${choice.letter}. ${choice.content}`).join("<br>");
    } else {
      // Fallback: if we can't find answer choices, treat everything as question
      questionHTML = htmlContent;
      answersHTML = "No answer choices found";
    }
    
    // Helper function to check if a block has valid answer choices
    function hasValidAnswerChoices(content) {
      // Split content into lines
      let lines = content.split(/<br\s*\/?>|\n/);
      
      // Look for consecutive answer choices starting with A
      let consecutiveCount = 0;
      let foundA = false;
      
      for (let i = 0; i < Math.min(lines.length, 10); i++) {  // Check first 10 lines
        let line = lines[i].trim();
        if (line.match(/^\s*\(\s*A\s*\)/) || line.match(/^\s*A\s*\./) || line.match(/^\s*A\s*\)/)) {
          foundA = true;
          consecutiveCount = 1;
          
          // Check next lines for B, C, D, E
          for (let j = 1; j < 5; j++) {
            if (i + j < lines.length) {
              let nextLine = lines[i + j].trim();
              let expectedLetter = String.fromCharCode(65 + j);  // B, C, D, E
              if (nextLine.match(new RegExp(`^\\s*\\(\\s*${expectedLetter}\\s*\\)`, 'i')) || 
                  nextLine.match(new RegExp(`^\\s*${expectedLetter}\\s*\\.`, 'i')) || 
                  nextLine.match(new RegExp(`^\\s*${expectedLetter}\\s*\\)`, 'i'))) {
                consecutiveCount++;
              } else {
                break;
              }
            }
          }
          break;
        }
      }
      
      // We need at least 2 consecutive answer choices to be confident
      return consecutiveCount >= 2;
    }
    
    // Helper function to find the start of the answer block
    function findAnswerBlockStart(content) {
      // Split content into lines
      let lines = content.split(/<br\s*\/?>|\n/);
      
      // Look for consecutive answer choices
      for (let i = 0; i < lines.length - 1; i++) {
        let line = lines[i].trim();
        // Check if this line starts with answer choice A
        if (line.match(/^\s*\(\s*A\s*\)/) || line.match(/^\s*A\s*\./) || line.match(/^\s*A\s*\)/)) {
          // Check if next line starts with answer choice B
          let nextLine = lines[i + 1].trim();
          if (nextLine.match(/^\s*\(\s*B\s*\)/) || nextLine.match(/^\s*B\s*\./) || nextLine.match(/^\s*B\s*\)/)) {
            // Found consecutive answer choices, calculate the start index
            let upToIndex = 0;
            for (let j = 0; j < i; j++) {
              upToIndex += lines[j].length + 1;  // +1 for the newline/br
            }
            return upToIndex;
          }
        }
      }
      
      return -1;  // Not found
    }
    
    // Helper function to extract answer choices
    function extractAnswerChoices(content) {
      let answerChoices = [];
      let lines = content.split(/<br\s*\/?>|\n/);
      let capturing = false;
      let currentChoice = null;
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Check if this line starts an answer choice
        let match = line.match(/^\s*[\(\[]?\s*([A-E])\s*[\.\)]?\s*/i);
        if (match) {
          let letter = match[1].toUpperCase();
          
          // If we were already capturing a choice, save it
          if (currentChoice) {
            answerChoices.push(currentChoice);
          }
          
          // Start capturing new choice
          capturing = true;
          let contentStart = match[0].length;
          currentChoice = {
            letter: letter,
            content: line.substring(contentStart).trim()
          };
        } else if (capturing && currentChoice) {
          // Continue adding content to the current choice
          if (line.length > 0) {
            currentChoice.content += " " + line;
          }
        }
      }
      
      // Don't forget the last choice
      if (currentChoice) {
        answerChoices.push(currentChoice);
      }
      
      return answerChoices;
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
  
  extractContent();
})();
