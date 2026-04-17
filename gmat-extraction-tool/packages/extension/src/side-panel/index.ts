/**
 * Side Panel - Batch Scraper UI
 *
 * Persistent Chrome Side Panel that coordinates batch scraping.
 * Communicates with background service worker via chrome.runtime messaging.
 * Category discovery is delegated to the content script on the active GMAT Hero tab.
 */

interface CategoryDefinition {
    id: string;
    name: string;
    section: string;
    url: string;
    questionCount: number;
}

interface TabWorker {
    tabId: number;
    categoryId: string | null;
    categoryName: string | null;
    status: 'idle' | 'scraping' | 'navigating';
    questionsExtracted: number;
    currentQuestionIndex: number;
}

// ============================================
// DOM References
// ============================================
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const btnDiscover = $('#btn-discover') as HTMLButtonElement;
const btnSelectAll = $('#btn-select-all') as HTMLButtonElement;
const btnDeselectAll = $('#btn-deselect-all') as HTMLButtonElement;
const btnStart = $('#btn-start') as HTMLButtonElement;
const btnStop = $('#btn-stop') as HTMLButtonElement;
const categoryListEl = $('#category-list');
const progressSection = $('#progress-section');
const resultsSection = $('#results-section');
const statusBadge = $('#status-badge');
const chkIncorrectOnly = $('#chk-incorrect-only') as HTMLInputElement;
const selConcurrency = $('#sel-concurrency') as HTMLSelectElement;

let discoveredCategories: CategoryDefinition[] = [];

// Show version from manifest
const versionLabel = document.getElementById('version-label');
if (versionLabel) {
    const manifest = chrome.runtime.getManifest();
    versionLabel.textContent = `v${manifest.version}`;
}

// Chrome settings link - can't navigate directly to chrome:// from extension page
const linkChromeSettings = document.getElementById('link-chrome-settings');
if (linkChromeSettings) {
    linkChromeSettings.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://settings/downloads' });
    });
}

// ============================================
// Category Discovery
// ============================================
btnDiscover.addEventListener('click', async () => {
    btnDiscover.textContent = '🔄 Discovering...';
    btnDiscover.disabled = true;

    try {
        // Find the active GMAT Hero tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const gmTab = tabs.find(t => t.url?.includes('gmat-hero'));

        if (!gmTab?.id) {
            // Try any GMAT Hero tab
            const allTabs = await chrome.tabs.query({ url: '*://gmat-hero-v2.web.app/*' });
            if (allTabs.length === 0) {
                btnDiscover.textContent = '❌ No GMAT Hero tab found';
                setTimeout(() => {
                    btnDiscover.textContent = '🔍 Discover Categories from Active Tab';
                    btnDiscover.disabled = false;
                }, 3000);
                return;
            }
            // Use the first GMAT Hero tab
            const tabId = allTabs[0].id!;
            const response = await chrome.tabs.sendMessage(tabId, { action: 'DISCOVER_CATEGORIES' });
            handleDiscoveryResponse(response);
        } else {
            const response = await chrome.tabs.sendMessage(gmTab.id, { action: 'DISCOVER_CATEGORIES' });
            handleDiscoveryResponse(response);
        }
    } catch (err) {
        console.error('Discovery failed:', err);
        btnDiscover.textContent = '❌ Discovery failed - is a GMAT Hero page open?';
        setTimeout(() => {
            btnDiscover.textContent = '🔍 Discover Categories from Active Tab';
            btnDiscover.disabled = false;
        }, 3000);
    }
});

function handleDiscoveryResponse(response: { categories?: CategoryDefinition[] }) {
    if (response?.categories && response.categories.length > 0) {
        discoveredCategories = response.categories;
        renderCategoryList(discoveredCategories);
        btnDiscover.textContent = `✅ Found ${discoveredCategories.length} categories`;
    } else {
        btnDiscover.textContent = '❌ No categories found on this page';
    }
    setTimeout(() => {
        btnDiscover.textContent = '🔍 Discover Categories from Active Tab';
        btnDiscover.disabled = false;
    }, 3000);
}

// ============================================
// Category List Rendering
// ============================================
function renderCategoryList(categories: CategoryDefinition[]) {
    const grouped: Record<string, CategoryDefinition[]> = {};
    for (const cat of categories) {
        const s = cat.section || 'unknown';
        if (!grouped[s]) grouped[s] = [];
        grouped[s].push(cat);
    }

    const labels: Record<string, string> = {
        verbal: '💬 Verbal',
        quant: '📐 Quant',
        di: '📊 Data Insights',
        unknown: '❓ Other'
    };

    let html = '';
    for (const section of ['verbal', 'quant', 'di', 'unknown']) {
        const cats = grouped[section];
        if (!cats || cats.length === 0) continue;

        html += `<div class="cat-section-label">${labels[section] || section}</div>`;
        for (const cat of cats) {
            html += `
                <label class="cat-item">
                    <input type="checkbox" class="cat-checkbox" checked
                        data-id="${esc(cat.id)}"
                        data-name="${esc(cat.name)}"
                        data-section="${esc(cat.section)}"
                        data-url="${esc(cat.url)}"
                        data-count="${cat.questionCount}">
                    <span class="name">${escHtml(cat.name)}</span>
                    ${cat.questionCount ? `<span class="count">${cat.questionCount}Q</span>` : ''}
                </label>`;
        }
    }

    categoryListEl.innerHTML = html;

    // Update button count on change
    categoryListEl.querySelectorAll<HTMLInputElement>('.cat-checkbox').forEach(cb => {
        cb.addEventListener('change', updateStartButton);
    });
    updateStartButton();
}

function updateStartButton() {
    const checked = categoryListEl.querySelectorAll<HTMLInputElement>('.cat-checkbox:checked').length;
    const total = categoryListEl.querySelectorAll('.cat-checkbox').length;
    btnStart.textContent = total > 0 ? `▶ Start Batch (${checked}/${total})` : '▶ Start Batch';
    btnStart.disabled = checked === 0;
}

btnSelectAll.addEventListener('click', () => {
    categoryListEl.querySelectorAll<HTMLInputElement>('.cat-checkbox').forEach(cb => cb.checked = true);
    updateStartButton();
});
btnDeselectAll.addEventListener('click', () => {
    categoryListEl.querySelectorAll<HTMLInputElement>('.cat-checkbox').forEach(cb => cb.checked = false);
    updateStartButton();
});

// ============================================
// Start / Stop Batch
// ============================================
btnStart.addEventListener('click', () => {
    const selected = getSelectedCategories();
    if (selected.length === 0) return;

    const concurrency = parseInt(selConcurrency.value, 10) || 3;
    const incorrectOnly = chkIncorrectOnly.checked;

    // UI: switch to running state
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    progressSection.classList.add('active');
    resultsSection.classList.remove('active');
    statusBadge.textContent = 'Running';
    statusBadge.className = 'status-badge running';
    categoryListEl.querySelectorAll<HTMLInputElement>('.cat-checkbox').forEach(cb => cb.disabled = true);

    // Init worker list UI
    const workerListEl = $('#worker-list');
    workerListEl.innerHTML = '';
    for (let i = 0; i < concurrency; i++) {
        workerListEl.innerHTML += `
            <div class="worker-row" id="worker-${i}">
                <span class="worker-dot idle"></span>
                <span class="worker-name">Waiting...</span>
                <span class="worker-status"></span>
            </div>`;
    }

    chrome.runtime.sendMessage({
        action: 'BATCH_START',
        categories: selected,
        incorrectOnly,
        concurrency
    });
});

btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'BATCH_STOP' });
});

function getSelectedCategories(): CategoryDefinition[] {
    const categories: CategoryDefinition[] = [];
    categoryListEl.querySelectorAll<HTMLInputElement>('.cat-checkbox:checked').forEach(cb => {
        categories.push({
            id: cb.dataset.id || '',
            name: cb.dataset.name || '',
            section: cb.dataset.section || '',
            url: cb.dataset.url || '',
            questionCount: parseInt(cb.dataset.count || '0', 10)
        });
    });
    return categories;
}

// ============================================
// Progress Updates
// ============================================
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'BATCH_PROGRESS') {
        updateProgress(message.data);
    }
    if (message.action === 'BATCH_COMPLETE') {
        showCompletion(message.data);
    }
});

function updateProgress(data: {
    workers?: TabWorker[];
    stats?: { completedCategories: number; totalCategories: number; totalQuestions: number; totalErrors: number };
    queueLength?: number;
    status?: string;
}) {
    const stats = data.stats;
    if (!stats) return;

    const pctDone = stats.totalCategories > 0
        ? (stats.completedCategories / stats.totalCategories) * 100
        : 0;

    ($('#progress-label')).textContent = `${stats.completedCategories} of ${stats.totalCategories} categories done`;
    ($('#progress-count')).textContent = `${stats.totalQuestions} questions`;
    ($('#progress-bar')).style.width = `${pctDone}%`;
    ($('#progress-details')).textContent =
        `${data.queueLength ?? 0} queued · ${stats.totalErrors} errors`;

    // Update worker rows
    if (data.workers) {
        data.workers.forEach((w, i) => {
            const row = $(`#worker-${i}`);
            if (!row) return;
            const dot = row.querySelector('.worker-dot') as HTMLElement;
            const name = row.querySelector('.worker-name') as HTMLElement;
            const status = row.querySelector('.worker-status') as HTMLElement;

            if (w.status === 'scraping') {
                dot.className = 'worker-dot active';
                name.textContent = w.categoryName || w.categoryId || 'Extracting...';
                status.textContent = `Q${w.currentQuestionIndex + 1} · ${w.questionsExtracted} done`;
            } else if (w.status === 'navigating') {
                dot.className = 'worker-dot active';
                name.textContent = w.categoryName || 'Loading...';
                status.textContent = 'navigating';
            } else {
                dot.className = 'worker-dot idle';
                name.textContent = 'Idle';
                status.textContent = '';
            }
        });
    }
}

function showCompletion(data: {
    stats?: { completedCategories: number; totalCategories: number; totalQuestions: number; totalErrors: number };
    errors?: { categoryName: string; severity: string }[];
}) {
    // UI: switch to complete state
    btnStop.style.display = 'none';
    btnStart.style.display = 'block';
    btnStart.disabled = false;
    progressSection.classList.remove('active');
    resultsSection.classList.add('active');
    statusBadge.textContent = 'Complete';
    statusBadge.className = 'status-badge complete';
    categoryListEl.querySelectorAll<HTMLInputElement>('.cat-checkbox').forEach(cb => cb.disabled = false);

    // Fill progress bar to 100%
    ($('#progress-bar')).style.width = '100%';

    const stats = data.stats;
    if (stats) {
        ($('#results-summary')).innerHTML = `
            <div>Categories: ${stats.completedCategories}/${stats.totalCategories}</div>
            <div>Questions: ${stats.totalQuestions}</div>
            <div>Errors: ${stats.totalErrors}</div>
            <div style="margin-top: 6px; color: #667eea;">Files saved to Downloads</div>`;
    }

    // Show errors if any
    const errors = data.errors || [];
    const errorsOnly = errors.filter(e => e.severity === 'error');
    if (errorsOnly.length > 0) {
        ($('#results-errors')).style.display = 'block';
        const byCat: Record<string, number> = {};
        for (const e of errorsOnly) {
            byCat[e.categoryName] = (byCat[e.categoryName] || 0) + 1;
        }
        let html = '';
        for (const [cat, count] of Object.entries(byCat)) {
            html += `<div>• ${escHtml(cat)}: ${count} issue(s)</div>`;
        }
        html += `<div style="margin-top: 6px; color: #667eea; font-style: italic;">See error-report.json for details</div>`;
        ($('#error-summary')).innerHTML = html;
    } else {
        ($('#results-errors')).style.display = 'none';
    }
}

// ============================================
// On Load: Check if batch is already running
// ============================================
chrome.runtime.sendMessage({ action: 'BATCH_STATUS' }, (response) => {
    if (response?.state?.status === 'running') {
        // Restore running UI
        btnStart.style.display = 'none';
        btnStop.style.display = 'block';
        progressSection.classList.add('active');
        statusBadge.textContent = 'Running';
        statusBadge.className = 'status-badge running';

        // Init worker rows
        const workers = response.state.workers || [];
        const workerListEl = $('#worker-list');
        workerListEl.innerHTML = '';
        workers.forEach((_: TabWorker, i: number) => {
            workerListEl.innerHTML += `
                <div class="worker-row" id="worker-${i}">
                    <span class="worker-dot idle"></span>
                    <span class="worker-name">Loading...</span>
                    <span class="worker-status"></span>
                </div>`;
        });

        updateProgress(response.state);
    }
});

// ============================================
// Helpers
// ============================================
function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escHtml(s: string): string {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}
