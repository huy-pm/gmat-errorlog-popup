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
  
  extractContent();
})();