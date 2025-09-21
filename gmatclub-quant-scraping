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

    // Keep MathJax TeX for rendering
    clone.querySelectorAll('script[type="math/tex"]').forEach(script => {
      let tex = script.textContent.trim();
      let span = document.createElement('span');
      span.textContent = "$" + tex + "$"; // inline TeX
      script.replaceWith(span);
    });

    let rawText = clone.innerText.trim();
    let match = rawText.match(/(.*?)\s*(A\..*)/s);
    if (!match) {
      alert('Could not split into question and choices.');
      return;
    }

    let question = match[1].trim();
    let answers = match[2].trim().replace(/\n/g, "<br>");

    // Create overlay
    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '10%';
    overlay.style.left = '10%';
    overlay.style.width = '80%';
    overlay.style.height = '80%';
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
      <div id="bookmarklet-question">${question}</div>
      <h2>Answer Choices</h2>
      <div id="bookmarklet-answers">${answers}</div>
      <button id="bookmarklet-copy" style="margin-top:20px;padding:5px 10px;">Copy to Clipboard</button>
      <button id="bookmarklet-close" style="margin-top:20px;margin-left:10px;padding:5px 10px;">Close</button>
    `;

    document.body.appendChild(overlay);

    // Close button
    document.getElementById("bookmarklet-close").onclick = () => overlay.remove();

    // Copy button
    document.getElementById("bookmarklet-copy").onclick = () => {
      let plainAnswers = match[2].trim();
      let copyText = "Question:\n" + question + "\n\nAnswer Choices:\n" + plainAnswers;
      navigator.clipboard.writeText(copyText).then(() => {
        alert("Copied to clipboard!");
      }).catch(err => {
        alert("Copy failed: " + err);
      });
    };

    // Load MathJax if not already loaded
    if (typeof MathJax === "undefined") {
      let script = document.createElement("script");
      script.type = "text/javascript";
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      document.head.appendChild(script);
      script.onload = () => {
        MathJax.typesetPromise([overlay]);
      };
    } else {
      MathJax.typesetPromise([overlay]);
    }
  }

  extractContent();
})();
