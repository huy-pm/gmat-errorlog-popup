(function () {
  if (document.getElementById("side-panel-container")) {
    const c = document.getElementById("side-panel-container");
    c.classList.toggle("open");
    updateExpandBtn();
    return;
  }

  const container = document.createElement("div");
  container.id = "side-panel-container";

  container.innerHTML = `
    <div id="side-panel">
      <div id="resize-btn"></div>
      <div id="panel-header">
        <span>My Side Panel</span>
        <button id="toggle-btn">⮜</button>
      </div>
      <div id="panel-content">
        <p>Resizable with a small middle drag button.</p>
      </div>
    </div>

    <!-- Bigger expand button -->
    <button id="expand-btn">⮞ Open Panel</button>
  `;

  document.body.appendChild(container);

  const style = document.createElement("style");
  style.innerHTML = `
    #side-panel-container {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      z-index: 999999;
      display: flex;
      pointer-events: none;
    }

    #side-panel {
      width: 320px;
      max-width: 85vw;
      min-width: 200px;
      height: 100%;
      background: #fff;
      border-left: 1px solid #ccc;
      box-shadow: -3px 0 10px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.25s ease;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      font-family: sans-serif;
      position: relative;
    }

    #side-panel-container.open #side-panel {
      transform: translateX(0);
    }

    /* Small draggable button */
    #resize-btn {
      position: absolute;
      left: -7px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      background: #ddd;
      border: 1px solid #aaa;
      border-radius: 50%;
      cursor: ew-resize;
      z-index: 1000001;
      pointer-events: auto;
    }

    #resize-btn:hover {
      background: #ccc;
    }

    #panel-header {
      background: #f5f5f5;
      padding: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #ccc;
    }

    #toggle-btn {
      cursor: pointer;
      padding: 4px 6px;
      font-size: 16px;
      background: none;
      border: none;
    }

    #panel-content {
      padding: 10px;
      overflow-y: auto;
      flex-grow: 1;
    }

    /* BIGGER EXPAND BUTTON */
    #expand-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      padding: 10px 16px;
      font-size: 16px;
      font-weight: bold;
      border-radius: 8px 0 0 8px;
      background: #ffffff;
      border: 1px solid #bbb;
      box-shadow: -3px 3px 8px rgba(0,0,0,0.15);
      cursor: pointer;
      pointer-events: auto;
      display: none;
      z-index: 1000003;
      color: #333;
    }

    #expand-btn:hover {
      background: #f7f7f7;
    }
  `;
  document.head.appendChild(style);

  const panel = document.getElementById("side-panel");
  const resizeBtn = document.getElementById("resize-btn");
  const toggleBtn = document.getElementById("toggle-btn");
  const expandBtn = document.getElementById("expand-btn");

  toggleBtn.onclick = () => {
    container.classList.remove("open");
    updateExpandBtn();
  };

  expandBtn.onclick = () => {
    container.classList.add("open");
    updateExpandBtn();
  };

  // Resize logic
  let resizing = false;

  resizeBtn.addEventListener("mousedown", () => {
    resizing = true;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const newWidth = window.innerWidth - e.clientX;
    panel.style.width = Math.min(Math.max(newWidth, 200), window.innerWidth * 0.85) + "px";
  });

  document.addEventListener("mouseup", () => {
    resizing = false;
    document.body.style.userSelect = "";
  });

  function updateExpandBtn() {
    expandBtn.style.display = container.classList.contains("open") ? "none" : "block";
  }

  setTimeout(() => {
    container.classList.add("open");
    updateExpandBtn();
  }, 10);
})();
