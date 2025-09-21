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
    clone.querySelectorAll('.mjx-chtml, .MJX_Assistive_MathML').forEach(el => el.remove());

    // Replace TeX scripts with proper delimiters ($...$ for inline, $$...$$ for block)
    clone.querySelectorAll('script[type="math/tex"]').forEach(script => {
      let tex = script.textContent.trim();
      let span = document.createElement('span');
      if (script.getAttribute("mode") === "display") {
        span.textContent = "$$" + tex + "$$";   // block math
      } else {
        span.textContent = "$" + tex + "$";     // inline math
      }
      script.replaceWith(span);
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

    overlay.innerHTML = `
      <h2>Question</h2>
      <div id="bookmarklet-question">${questionHTML}</div>
      <h2>Answer Choices</h2>
      <div id="bookmarklet-answers">${answersHTML}</div>
      <button id="bookmarklet-copy" style="margin-top:20px;padding:5px 10px;">Copy to Clipboard</button>
      <button id="bookmarklet-close" style="margin-top:20px;margin-left:10px;padding:5px 10px;">Close</button>
    `;

    document.body.appendChild(overlay);

    // Close button
    document.getElementById("bookmarklet-close").onclick = () => overlay.remove();

    // Copy button
    document.getElementById("bookmarklet-copy").onclick = () => {
      let copyText = "Question:\n" + match[1].trim() + "\n\nAnswer Choices:\n" + answersPlain;
      navigator.clipboard.writeText(copyText).then(() => {
        alert("Copied to clipboard!");
      }).catch(err => {
        alert("Copy failed: " + err);
      });
    };

    // Load MathJax if not already loaded
    function typeset() {
      MathJax.typesetPromise([overlay]).catch(err => console.error(err));
    }

    if (typeof MathJax === "undefined") {
      let script = document.createElement("script");
      script.type = "text/javascript";
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      document.head.appendChild(script);
      script.onload = () => typeset();
    } else {
      typeset();
    }
  }

  extractContent();
})();
