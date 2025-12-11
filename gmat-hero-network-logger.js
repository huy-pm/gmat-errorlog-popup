javascript: (function () {
    if (window.__networkLogger) { alert('Network logger already running!'); return; }

    window.__networkLogger = {
        logs: [],
        originalXHR: window.XMLHttpRequest,
        originalFetch: window.fetch
    };

    // Function to convert to curl
    function toCurl(log) {
        let curl = `curl -X ${log.method} '${log.url}'`;

        // Add headers
        if (log.headers && typeof log.headers === 'object') {
            for (let [key, value] of Object.entries(log.headers)) {
                if (typeof value === 'string') {
                    curl += ` \\\n  -H '${key}: ${value}'`;
                }
            }
        }

        // Add request headers from XHR
        if (log.requestHeaders) {
            const headers = log.requestHeaders.split('\n');
            headers.forEach(h => {
                const [key, value] = h.split(':').map(s => s.trim());
                if (key && value) {
                    curl += ` \\\n  -H '${key}: ${value}'`;
                }
            });
        }

        // Add payload
        if (log.payload) {
            const payloadStr = typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload);
            curl += ` \\\n  -d '${payloadStr.replace(/'/g, "'\"'\"'")}'`;
        }

        return curl;
    }

    window.__networkLogger.toCurl = toCurl;

    // Intercept XMLHttpRequest
    window.XMLHttpRequest = function () {
        const xhr = new window.__networkLogger.originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        const originalSetRequestHeader = xhr.setRequestHeader;
        let requestData = { method: '', url: '', payload: null, response: null, timestamp: null, headers: {}, requestHeaders: '' };

        xhr.open = function (method, url) {
            requestData.method = method;
            requestData.url = url;
            requestData.timestamp = new Date().toISOString();
            return originalOpen.apply(this, arguments);
        };

        xhr.setRequestHeader = function (header, value) {
            requestData.headers[header] = value;
            requestData.requestHeaders += `${header}: ${value}\n`;
            return originalSetRequestHeader.apply(this, arguments);
        };

        xhr.send = function (data) {
            requestData.payload = data;

            xhr.addEventListener('load', function () {
                requestData.response = {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText,
                    headers: xhr.getAllResponseHeaders()
                };
                window.__networkLogger.logs.push(JSON.parse(JSON.stringify(requestData)));
            });

            return originalSend.apply(this, arguments);
        };

        return xhr;
    };

    // Intercept Fetch
    window.fetch = async function (...args) {
        const [url, options = {}] = args;
        const requestData = {
            method: options.method || 'GET',
            url: url.toString(),
            payload: options.body || null,
            headers: options.headers || {},
            timestamp: new Date().toISOString()
        };

        try {
            const response = await window.__networkLogger.originalFetch.apply(this, args);
            const clonedResponse = response.clone();
            const responseText = await clonedResponse.text();

            requestData.response = {
                status: response.status,
                statusText: response.statusText,
                responseText: responseText,
                headers: Object.fromEntries(response.headers.entries())
            };

            window.__networkLogger.logs.push(JSON.parse(JSON.stringify(requestData)));
            return response;
        } catch (error) {
            requestData.response = { error: error.message };
            window.__networkLogger.logs.push(JSON.parse(JSON.stringify(requestData)));
            throw error;
        }
    };

    // Create UI
    const ui = document.createElement('div');
    ui.id = 'networkLoggerUI';
    ui.innerHTML = `
    <div style="position:fixed;bottom:10px;right:10px;width:400px;max-height:600px;background:#1e1e1e;color:#fff;border:2px solid #4CAF50;border-radius:8px;z-index:999999;font-family:monospace;font-size:12px;box-shadow:0 4px 20px rgba(0,0,0,0.5)">
      <div style="padding:10px;background:#4CAF50;cursor:move;display:flex;justify-content:space-between;align-items:center" id="loggerHeader">
        <strong>🌐 Network Logger</strong>
        <div>
          <button id="clearLogs" style="background:#ff5722;border:none;color:#fff;padding:3px 8px;border-radius:3px;cursor:pointer;margin-right:5px">Clear</button>
          <button id="exportJSON" style="background:#2196F3;border:none;color:#fff;padding:3px 8px;border-radius:3px;cursor:pointer;margin-right:5px">JSON</button>
          <button id="exportCurl" style="background:#FF9800;border:none;color:#fff;padding:3px 8px;border-radius:3px;cursor:pointer;margin-right:5px">cURL</button>
          <button id="closeLogger" style="background:#f44336;border:none;color:#fff;padding:3px 8px;border-radius:3px;cursor:pointer">✕</button>
        </div>
      </div>
      <div style="padding:10px;max-height:550px;overflow-y:auto" id="logContent">
        <div style="color:#aaa">Waiting for requests...</div>
      </div>
    </div>
  `;
    document.body.appendChild(ui);

    // Make draggable
    const header = document.getElementById('loggerHeader');
    let isDragging = false, offsetX, offsetY;
    header.onmousedown = (e) => { isDragging = true; offsetX = e.clientX - ui.firstChild.offsetLeft; offsetY = e.clientY - ui.firstChild.offsetTop; };
    document.onmousemove = (e) => { if (isDragging) { ui.firstChild.style.left = (e.clientX - offsetX) + 'px'; ui.firstChild.style.top = (e.clientY - offsetY) + 'px'; ui.firstChild.style.right = 'auto'; } };
    document.onmouseup = () => { isDragging = false; };

    // Update UI every 1 second
    setInterval(() => {
        const content = document.getElementById('logContent');
        if (window.__networkLogger.logs.length === 0) {
            content.innerHTML = '<div style="color:#aaa">Waiting for requests...</div>';
        } else {
            content.innerHTML = window.__networkLogger.logs.map((log, idx) => `
        <div style="margin-bottom:10px;padding:8px;background:#2d2d2d;border-left:3px solid #4CAF50;border-radius:4px">
          <div style="color:#4CAF50;font-weight:bold">#${idx + 1} ${log.method} ${log.timestamp}</div>
          <div style="color:#64B5F6;margin:3px 0;word-break:break-all">${log.url}</div>
          ${log.payload ? `<div style="color:#FFD54F;margin:3px 0"><strong>Payload:</strong> ${typeof log.payload === 'string' ? log.payload.substring(0, 100) : JSON.stringify(log.payload).substring(0, 100)}...</div>` : ''}
          ${log.response ? `<div style="color:#81C784;margin:3px 0"><strong>Status:</strong> ${log.response.status || 'N/A'}</div>` : ''}
          <button onclick="console.log('Request #${idx + 1}:', window.__networkLogger.logs[${idx}]); alert('Logged to console!')" style="background:#673AB7;border:none;color:#fff;padding:2px 6px;border-radius:3px;cursor:pointer;margin-top:5px;margin-right:3px">Console</button>
          <button onclick="navigator.clipboard.writeText(window.__networkLogger.toCurl(window.__networkLogger.logs[${idx}])).then(() => alert('cURL copied to clipboard!')).catch(() => {const t=window.__networkLogger.toCurl(window.__networkLogger.logs[${idx}]);prompt('Copy this cURL command:',t)})" style="background:#FF9800;border:none;color:#fff;padding:2px 6px;border-radius:3px;cursor:pointer;margin-top:5px">Copy cURL</button>
        </div>
      `).join('');
        }
    }, 1000);

    // Event handlers
    document.getElementById('closeLogger').onclick = () => { ui.remove(); delete window.__networkLogger; };
    document.getElementById('clearLogs').onclick = () => { window.__networkLogger.logs = []; };

    document.getElementById('exportJSON').onclick = () => {
        const blob = new Blob([JSON.stringify(window.__networkLogger.logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-logs-${Date.now()}.json`;
        a.click();
    };

    document.getElementById('exportCurl').onclick = () => {
        const curlCommands = window.__networkLogger.logs.map((log, idx) => {
            return `# Request #${idx + 1} - ${log.timestamp}\n${toCurl(log)}\n`;
        }).join('\n');

        const blob = new Blob([curlCommands], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-curl-${Date.now()}.sh`;
        a.click();

        alert(`Exported ${window.__networkLogger.logs.length} requests as cURL commands!`);
    };

    console.log('✅ Network Logger active! Intercepting XHR and Fetch requests...');
})();