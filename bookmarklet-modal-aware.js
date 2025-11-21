(function () {
  'use strict';

  // Prevent multiple injections
  if (document.getElementById('smartlog-split-container')) {
    alert('SmartLog AI Sidebar is already open!');
    return;
  }

  window.__SMARTLOG_INJECTED__ = true;

  // --- Icons (SVG Strings) ---
  const ICONS = {
    zap: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-600"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l5 5a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-5-5z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    loader: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    brain: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
    gripVertical: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`
  };

  const PREDEFINED_TAGS = [
    "Careless", "Comprehension Issues", "Concept Unknown",
    "Content Knowledge Gap", "Fell Trap Answer Choice", "Formula/Rule Forgotten",
    "Weaken", "Strengthen", "Assumption", "SC", "CR", "RC"
  ];

  const state = {
    sidebarWidth: 400,
    isCollapsed: false,
    activeTab: 'log',
    isAnalyzing: false,
    apiKey: localStorage.getItem('gemini_api_key') || '',
    logData: {
      url: window.location.href,
      notes: '',
      tags: [],
      source: document.title
    },
    aiReasoning: null
  };

  // --- Create FIXED Sidebar (Always Visible Over Modals) ---

  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'smartlog-split-container';
  sidebarContainer.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: ${state.sidebarWidth}px !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: white !important;
    box-shadow: -5px 0 20px rgba(0,0,0,0.15) !important;
    display: flex !important;
    flex-direction: row !important;
    transition: transform 0.3s ease-in-out !important;
  `;

  // Resize Handle
  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'smartlog-resize-handle';
  resizeHandle.style.cssText = `
    width: 12px !important;
    height: 100% !important;
    background: transparent !important;
    cursor: col-resize !important;
    position: absolute !important;
    left: -6px !important;
    top: 0 !important;
    z-index: 2147483648 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;
  const handleVisual = document.createElement('div');
  handleVisual.style.cssText = `
    width: 4px !important;
    height: 40px !important;
    background: #e5e7eb !important;
    border-radius: 2px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
  `;
  resizeHandle.appendChild(handleVisual);
  resizeHandle.addEventListener('mouseenter', () => handleVisual.style.background = '#d1d5db');
  resizeHandle.addEventListener('mouseleave', () => handleVisual.style.background = '#e5e7eb');

  // Content Area
  const contentArea = document.createElement('div');
  contentArea.style.cssText = `
    flex: 1 !important;
    height: 100% !important;
    overflow: hidden !important;
    position: relative !important;
    background: white !important;
  `;

  // Expand Button
  const expandButton = document.createElement('button');
  expandButton.id = 'smartlog-expand-button';
  expandButton.style.cssText = `
    position: fixed !important;
    right: 0 !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    background: white !important;
    border: 1px solid #d1d5db !important;
    padding: 8px !important;
    border-radius: 8px 0 0 8px !important;
    box-shadow: -2px 2px 8px rgba(0,0,0,0.1) !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    display: none !important;
  `;
  expandButton.innerHTML = `<div style="color: #eab308;">${ICONS.zap}</div>`;
  expandButton.onclick = () => {
    state.isCollapsed = false;
    updateLayout();
  };

  // Assemble
  sidebarContainer.appendChild(resizeHandle);
  sidebarContainer.appendChild(contentArea);
  document.body.appendChild(sidebarContainer);
  document.body.appendChild(expandButton);

  // --- Adjust Body Margin ---
  const originalBodyTransition = document.body.style.transition;
  document.body.style.transition = 'margin-right 0.3s ease-in-out';

  function updateLayout() {
    if (state.isCollapsed) {
      sidebarContainer.style.transform = 'translateX(100%)';
      document.body.style.marginRight = '0px';
      expandButton.style.display = 'block';
    } else {
      sidebarContainer.style.transform = 'translateX(0)';
      sidebarContainer.style.width = `${state.sidebarWidth}px`;
      document.body.style.marginRight = `${state.sidebarWidth}px`;
      expandButton.style.display = 'none';
    }
  }

  updateLayout();

  // --- Detect Modals and Adjust Z-Index ---
  function detectAndHandleModals() {
    // Find all elements with very high z-index that might be modals
    const allElements = document.querySelectorAll('*');
    let maxZIndex = 2147483647;

    allElements.forEach(el => {
      const zIndex = parseInt(window.getComputedStyle(el).zIndex);
      if (!isNaN(zIndex) && zIndex > maxZIndex) {
        maxZIndex = zIndex;
      }
    });

    // If we found a higher z-index, increase ours
    if (maxZIndex > 2147483647) {
      const newZIndex = maxZIndex + 10;
      sidebarContainer.style.zIndex = newZIndex;
      expandButton.style.zIndex = newZIndex;
      resizeHandle.style.zIndex = newZIndex + 1;
      console.log(`[SmartLog] Detected modal with z-index ${maxZIndex}, adjusted to ${newZIndex}`);
    }
  }

  // Monitor for DOM changes (modals appearing)
  const modalObserver = new MutationObserver(() => {
    detectAndHandleModals();
  });

  modalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  // Initial check
  detectAndHandleModals();

  // Also check periodically as a fallback
  setInterval(detectAndHandleModals, 1000);

  // --- Resize Logic ---
  let isResizing = false;
  let startX, startWidth;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebarContainer.offsetWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    sidebarContainer.style.transition = 'none';
    document.body.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = startX - e.clientX;
    const newWidth = Math.min(Math.max(startWidth + delta, 300), window.innerWidth * 0.8);
    state.sidebarWidth = newWidth;
    sidebarContainer.style.width = `${newWidth}px`;
    document.body.style.marginRight = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      sidebarContainer.style.transition = 'transform 0.3s ease-in-out';
      document.body.style.transition = 'margin-right 0.3s ease-in-out';
    }
  });

  // --- Shadow DOM & UI ---
  const shadow = contentArea.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
  shadow.appendChild(styleLink);

  const customStyles = document.createElement('style');
  customStyles.textContent = `
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;
  shadow.appendChild(customStyles);

  const container = document.createElement('div');
  container.className = "bg-white h-full flex flex-col text-gray-800 font-sans";
  shadow.appendChild(container);

  // --- Render Functions (Same as before) ---

  function render() {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = "p-4 border-b border-gray-200 flex justify-between items-center bg-white";
    header.innerHTML = `
      <div class="flex items-center space-x-2 text-gray-800">
        <div class="bg-yellow-100 p-1.5 rounded-md">${ICONS.zap}</div>
        <h2 class="font-bold text-lg">Quick Log</h2>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-settings" class="text-gray-400 hover:text-gray-600 transition p-1" title="Settings">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button id="btn-close" class="text-gray-400 hover:text-gray-600 transition p-1" title="Close Sidebar">
          ${ICONS.x}
        </button>
      </div>
    `;
    container.appendChild(header);

    if (state.activeTab !== 'settings') {
      const tabs = document.createElement('div');
      tabs.className = "flex border-b border-gray-200";
      tabs.innerHTML = `
        <button id="tab-log" class="flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${state.activeTab === 'log' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
          Manual Log
        </button>
        <button id="tab-ai" class="flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex justify-center items-center gap-2 ${state.activeTab === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
          ${ICONS.sparkles}
          AI Assistant
        </button>
      `;
      container.appendChild(tabs);
    } else {
      const settingsHeader = document.createElement('div');
      settingsHeader.className = "bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-600 flex items-center gap-2";
      settingsHeader.innerHTML = `<button id="back-from-settings" class="hover:text-gray-900">← Back</button><span>Settings</span>`;
      container.appendChild(settingsHeader);
    }

    const content = document.createElement('div');
    content.className = "flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar";
    if (state.activeTab === 'settings') renderSettings(content);
    else if (state.activeTab === 'log') renderLogTab(content);
    else renderAiTab(content);
    container.appendChild(content);

    if (state.activeTab !== 'settings') {
      const footer = document.createElement('div');
      footer.className = "p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3";
      footer.innerHTML = `
        <button id="btn-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-300 rounded-lg transition">Cancel</button>
        <button id="btn-save" class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition">Quick Add</button>
      `;
      container.appendChild(footer);
    }

    attachEvents(shadow);
  }

  function renderSettings(parent) {
    const div = document.createElement('div');
    div.className = "space-y-4";
    div.innerHTML = `
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">Gemini API Key</label>
        <input type="password" id="input-api-key" value="${state.apiKey}" class="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Enter your API Key">
        <p class="text-xs text-gray-500">Key is stored locally in your browser.</p>
      </div>
      <button id="btn-save-key" class="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700">Save Key</button>
    `;
    parent.appendChild(div);
  }

  function renderLogTab(parent) {
    const aiTrigger = document.createElement('div');
    aiTrigger.className = "bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100 shadow-sm";
    aiTrigger.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-sm font-bold text-purple-900 mb-1 flex items-center gap-2">${ICONS.brain} AI Smart Capture</h3>
          <p class="text-xs text-purple-700">Extract context, tags, and summary from this page automatically.</p>
        </div>
        <button id="btn-auto-fill" class="bg-white hover:bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition flex items-center gap-2" ${state.isAnalyzing ? 'disabled' : ''}>
          ${state.isAnalyzing ? ICONS.loader : ICONS.sparkles} ${state.isAnalyzing ? 'Analyzing...' : 'Auto-Fill'}
        </button>
      </div>
    `;
    parent.appendChild(aiTrigger);

    const urlGroup = document.createElement('div');
    urlGroup.className = "space-y-2";
    urlGroup.innerHTML = `
      <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.link} Question Link</label>
      <input type="text" id="input-url" value="${state.logData.url}" class="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
    `;
    parent.appendChild(urlGroup);

    const notesGroup = document.createElement('div');
    notesGroup.className = "space-y-2";
    notesGroup.innerHTML = `
      <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.fileText} Smart Notes</label>
      <div class="relative">
        <textarea id="input-notes" placeholder="Type: weaken hard - my mistake was..." class="w-full p-3 border border-gray-300 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-gray-700 leading-relaxed">${state.logData.notes}</textarea>
      </div>
    `;
    parent.appendChild(notesGroup);

    const tagsGroup = document.createElement('div');
    tagsGroup.className = "space-y-3";
    tagsGroup.innerHTML = `<label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.tag} Tags</label>`;
    const tagsContainer = document.createElement('div');
    tagsContainer.className = "flex flex-wrap gap-2";
    PREDEFINED_TAGS.forEach(tag => {
      const btn = document.createElement('button');
      const isActive = state.logData.tags.includes(tag);
      btn.className = `px-3 py-1 rounded-full text-xs border transition-all ${isActive ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`;
      btn.textContent = tag;
      btn.onclick = () => toggleTag(tag);
      tagsContainer.appendChild(btn);
    });
    tagsGroup.appendChild(tagsContainer);
    parent.appendChild(tagsGroup);
  }

  function renderAiTab(parent) {
    const aiContainer = document.createElement('div');
    aiContainer.className = "space-y-6 fade-in";
    if (state.isAnalyzing) {
      aiContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-gray-500">
          <div class="w-8 h-8 mb-4 text-purple-500">${ICONS.loader}</div>
          <p class="text-sm">Reading page content...</p>
        </div>`;
    } else if (state.aiReasoning) {
      aiContainer.innerHTML = `
        <div class="space-y-4">
          <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
            <h3 class="font-bold text-purple-900 flex items-center gap-2 mb-2">${ICONS.brain} AI Reasoning</h3>
            <p class="text-sm text-purple-800 leading-relaxed whitespace-pre-line">${state.aiReasoning}</p>
          </div>
          <button id="btn-review-log" class="w-full py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition text-left flex justify-between items-center group">
            <span>Review captured data in Log</span><span class="text-gray-400 group-hover:text-gray-600">→</span>
          </button>
        </div>`;
    } else {
      aiContainer.innerHTML = `
        <div class="text-center py-12">
          <div class="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">${ICONS.sparkles}</div>
          <h3 class="text-gray-900 font-medium mb-2">No Analysis Yet</h3>
          <button id="btn-run-analysis" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 shadow-md shadow-purple-100 transition">Run AI Analysis</button>
        </div>`;
    }
    parent.appendChild(aiContainer);
  }

  function attachEvents(root) {
    root.getElementById('btn-close')?.addEventListener('click', () => {
      state.isCollapsed = true;
      updateLayout();
    });
    root.getElementById('btn-settings')?.addEventListener('click', () => { state.activeTab = 'settings'; render(); });
    root.getElementById('tab-log')?.addEventListener('click', () => { state.activeTab = 'log'; render(); });
    root.getElementById('tab-ai')?.addEventListener('click', () => { state.activeTab = 'ai'; render(); });
    root.getElementById('back-from-settings')?.addEventListener('click', () => { state.activeTab = 'log'; render(); });
    root.getElementById('btn-save-key')?.addEventListener('click', () => {
      state.apiKey = root.getElementById('input-api-key').value;
      localStorage.setItem('gemini_api_key', state.apiKey);
      alert('API Key saved!');
      state.activeTab = 'log';
      render();
    });
    root.getElementById('input-url')?.addEventListener('input', (e) => state.logData.url = e.target.value);
    root.getElementById('input-notes')?.addEventListener('input', (e) => state.logData.notes = e.target.value);
    root.getElementById('btn-auto-fill')?.addEventListener('click', handleAnalysis);
    root.getElementById('btn-run-analysis')?.addEventListener('click', handleAnalysis);
    root.getElementById('btn-review-log')?.addEventListener('click', () => { state.activeTab = 'log'; render(); });
    root.getElementById('btn-cancel')?.addEventListener('click', () => { state.isCollapsed = true; updateLayout(); });
    root.getElementById('btn-save')?.addEventListener('click', () => {
      console.log('Saving Log:', state.logData);
      alert('Log Saved! (Check console for data)');
      state.isCollapsed = true;
      updateLayout();
    });
  }

  function toggleTag(tag) {
    if (state.logData.tags.includes(tag)) state.logData.tags = state.logData.tags.filter(t => t !== tag);
    else state.logData.tags.push(tag);
    render();
  }

  async function handleAnalysis() {
    if (!state.apiKey) {
      alert('Please set your Gemini API Key in Settings first.');
      state.activeTab = 'settings';
      render();
      return;
    }
    state.isAnalyzing = true;
    state.activeTab = 'ai';
    render();
    try {
      const pageText = document.body.innerText.substring(0, 10000);
      const analysis = await analyzeContent(pageText);
      state.aiReasoning = analysis.reasoning;
      state.logData.notes = state.logData.notes ? `${state.logData.notes}\n\n[AI Summary]: ${analysis.summary}` : `[AI Summary]: ${analysis.summary}`;
      state.logData.tags = [...new Set([...state.logData.tags, ...(analysis.suggestedTags || [])])];
      state.logData.source = analysis.detectedSource || state.logData.source;
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Check console.');
    } finally {
      state.isAnalyzing = false;
      render();
    }
  }

  async function analyzeContent(text) {
    const prompt = `Analyze this test prep question:\n"""\n${text}\n"""\nReturn JSON: { summary, reasoning, suggestedTags[], detectedSource, difficulty }`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${state.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    if (!response.ok) throw new Error(response.statusText);
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  }

  // --- Keyboard Shortcut: Ctrl+L (Cmd+L on Mac) ---
  document.addEventListener('keydown', (e) => {
    // Check for Ctrl+L (Windows/Linux) or Cmd+L (Mac)
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isLKey = e.key === 'l' || e.key === 'L';

    if (isCtrlOrCmd && isLKey) {
      e.preventDefault(); // Prevent default browser behavior

      // Toggle sidebar
      state.isCollapsed = !state.isCollapsed;
      updateLayout();

      console.log(`[SmartLog] Sidebar ${state.isCollapsed ? 'collapsed' : 'expanded'} via keyboard shortcut`);
    }
  });

  render();

})();
