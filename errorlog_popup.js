(function(){
  if (document.getElementById("gmatQuickAddPopup")) return;

  // ===== CSS =====
  const style = document.createElement("style");
  style.textContent = `
    #gmatQuickAddPopup {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 360px;
      background: white;
      border: 2px solid #333;
      border-radius: 8px;
      padding: 12px;
      font-family: Arial, sans-serif;
      z-index: 999999;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }
    #gmatQuickAddPopup input, 
    #gmatQuickAddPopup textarea {
      width: 100%;
      margin: 6px 0;
      padding: 6px;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    #gmatQuickAddPopup button {
      width: 100%;
      padding: 8px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    #gmatQuickAddPopup button:hover {
      background: #0056b3;
    }
    #gmatQuickAddSuggestion {
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 6px;
      margin-top: 2px;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      display: none;
    }
    #gmatQuickAddClose {
      position: absolute;
      top: 6px;
      right: 8px;
      cursor: pointer;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);

  // ===== HTML =====
  const popup = document.createElement("div");
  popup.id = "gmatQuickAddPopup";
  popup.innerHTML = `
    <div id="gmatQuickAddClose">✖</div>
    <input type="text" id="gmatQuickAddLink" placeholder="Link" />
    <textarea id="gmatQuickAddNote" rows="3" placeholder="Note..."></textarea>
    <div id="gmatQuickAddSuggestion"></div>
    <button id="gmatQuickAddSave">Save (Enter)</button>
  `;
  document.body.appendChild(popup);

  // ===== Auto-fill link =====
  document.getElementById("gmatQuickAddLink").value = window.location.href;

  const noteInput = document.getElementById("gmatQuickAddNote");
  const suggestionBox = document.getElementById("gmatQuickAddSuggestion");

  // ===== Suggestion list =====
  const suggestions = {
    "VB": "Verbal",
    "Q": "Quant",
    "D" : "DI",
    "CR": "Critical Reasoning",
    "AS": "Assumption",
    "ST": "Strengthen",
    "WK": "Weaken",
    "RC": "Reading Comprehension",
    "PS": "Problem Solving",
    "DS": "Data Sufficiency",
    "Alg": "Algebra",
    "NT": "Number Theory"
  };

  // ===== Show suggestion when typing =====
  noteInput.addEventListener("keyup", (e) => {
    const val = noteInput.value.split(" ").pop();
    const key = val.toUpperCase();
    if (suggestions[key]) {
      suggestionBox.textContent = suggestions[key];
      suggestionBox.style.display = "block";
      suggestionBox.onclick = () => {
        applySuggestion(key);
      };
    } else {
      suggestionBox.style.display = "none";
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveData();
    }
  });

  // ===== Accept suggestion with Tab =====
  noteInput.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && suggestionBox.style.display === "block") {
      e.preventDefault();
      const val = noteInput.value.split(" ").pop();
      const key = val.toUpperCase();
      if (suggestions[key]) {
        applySuggestion(key);
      }
    }
  });

  function applySuggestion(val) {
    let words = noteInput.value.split(" ");
    words.pop();
    words.push(suggestions[val]);
    noteInput.value = words.join(" ");
    suggestionBox.style.display = "none";
  }

  // ===== Save =====
  function saveData() {
    const data = {
      link: document.getElementById("gmatQuickAddLink").value,
      note: noteInput.value,
      createdAt: new Date().toISOString()
    };
    console.log("Saved:", data);

    // TODO: thay API của bạn vào đây
    // fetch("https://gmat-errorlog.vercel.app/api/add", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(data)
    // });

    alert("Saved!");
    document.body.removeChild(popup);
  }

  document.getElementById("gmatQuickAddSave").onclick = saveData;
  document.getElementById("gmatQuickAddClose").onclick = () => {
    document.body.removeChild(popup);
  };

  // Focus vào Note luôn
  noteInput.focus();
})();
