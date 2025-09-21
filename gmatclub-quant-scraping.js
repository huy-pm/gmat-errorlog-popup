javascript:(function() {
  function extractContent() {
    let container = document.querySelector('.item.text');
    if (!container) {
      alert('No question container found.');
      return;
    }
    let clone = container.cloneNode(true);
    
    // Remove unwanted blocks
    clone.querySelectorAll('.twoRowsBlock, .post_signature').forEach(el => el.remove());
    
    // Remove existing MathJax rendered HTML
    clone.querySelectorAll('.mjx-chtml, .MJX_Assistive_MathML, .MathJax, .MathJax_Display, .MathJax_Preview').forEach(el => el.remove());
    
    // Replace TeX scripts with proper delimiters
    clone.querySelectorAll('script[type="math/tex"]').forEach(script => {
      let tex = script.textContent.trim();
      let span = document.createElement('span');
      if (script.getAttribute("mode") === "display") {
        span.innerHTML = "\\[" + tex + "\\]";   // block math with escaped backslashes
      } else {
        span.innerHTML = "\\(" + tex + "\\)";   // inline math with escaped backslashes
      }
      script.replaceWith(span);
    });
    
    // Also handle script[type="math/tex; mode=display"]
    clone.querySelectorAll('script[type*="math/tex"]').forEach(script => {
      if (!script.hasAttribute('replaced')) {
        let tex = script.textContent.trim();
        let span = document.createElement('span');
        if (script.type.includes("display")) {
          span.innerHTML = "\\[" + tex + "\\]";
        } else {
          span.innerHTML = "\\(" + tex + "\\)";
        }
        script.replaceWith(span);
      }
    });
    
    // Extract text to split Question vs Answers
    let rawText = clone.innerText.trim();
    let match = rawText.match(/(.*?)\s*(A\..*)/s);
    
    if (!match) {
      alert('Could not split into question and choices.');
      return;
    }
    
    let questionHTML = clone.innerHTML.split(/A\./)[0].trim();
    let answersText = match[2].trim();
    
    // Clean answers: remove underscores, extra separators
    answersText = answersText.replace(/_{2,}/g, "").replace(/[\n\r]+/g, " ").trim();
    
    // Force each choice onto its own line
    let answersArray = answersText.match(/[A-E]\.\s*[^A-E]*/g) || [];
    let answersHTML = answersArray.map(a => a.trim()).join("<br>");
    let answersPlain = answersArray.map(a => a.trim()).join("\n");
    
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
      let copyText = "Question:\n" + match[1].trim() + "\n\nAnswer Choices:\n" + answersPlain;
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
          inlineMath: [['\\(', '\\)'], ['$', '$']],
          displayMath: [['\\[', '\\]'], ['$$', '$$']],
          processEscapes: true,
          processEnvironments: true
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
          ignoreHtmlClass: 'tex2jax_ignore',
          processHtmlClass: 'tex2jax_process'
        },
        startup: {
          pageReady: () => {
            return MathJax.startup.defaultPageReady().then(() => {
              console.log('MathJax initial typesetting complete');
              typesetOverlay();
            });
          }
        }
      };
    }
    
    function typesetOverlay() {
      if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise([overlay]).then(() => {
          console.log('Math typesetting complete');
        }).catch(err => {
          console.error('MathJax typesetting error:', err);
        });
      }
    }
    
    // Check if MathJax is loaded
    if (typeof MathJax === "undefined") {
      // Configure MathJax before loading
      configureMathJax();
      
      // Load MathJax 3
      let script = document.createElement("script");
      script.type = "text/javascript";
      script.id = "MathJax-script";
      script.async = true;
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      document.head.appendChild(script);
    } else {
      // MathJax already loaded, just typeset
      console.log('MathJax already loaded, typesetting...');
      // Reset MathJax if needed
      if (window.MathJax.startup) {
        MathJax.startup.document.clear();
        MathJax.startup.document.updateDocument();
      }
      typesetOverlay();
    }
  }
  
  extractContent();
})();
