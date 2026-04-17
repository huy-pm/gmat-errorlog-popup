
import { state } from '../state.js';
import {
    ICONS,
    createBadge,
    showStatus,
    getPracticeUrl,
    enrichquestionData,
    baseUrl,
    decodeHtmlEntities
} from '../utils/dom.js';
import {
    parseNotesAndLink,
    getAutoSuggestions,
    applySuggestion,
    ParsedNotes,
    Suggestion
} from '../logic.js';
import {
    fetchCategories,
    fetchTags,
    submitLog
} from '../api.js';
import {
    hasValidToken,
    authenticate,
    clearToken
} from '../auth-stub.js';

// Types for DOM elements
type HTMLElementWithValue = HTMLElement & { value: string };

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

function saveFormValuesToState(root: ShadowRoot | Document) {
    const questionLinkInput = root.getElementById('gmat-question-link') as HTMLInputElement;
    const notesTextarea = root.getElementById('gmat-notes') as HTMLTextAreaElement;

    if (questionLinkInput) {
        state.logData.url = questionLinkInput.value;
    }

    if (notesTextarea) {
        state.logData.notes = notesTextarea.value;
    }
}

function updateParsedPreview(questionLink: string, notes: string, root: ShadowRoot | Document) {
    const parsed = parseNotesAndLink(notes, questionLink, state.categories);
    const previewDiv = root.getElementById('gmat-parsed-preview') as HTMLElement;
    const badgesDiv = root.getElementById('gmat-parsed-badges') as HTMLElement;
    const notesP = root.getElementById('gmat-parsed-notes') as HTMLElement;

    if (!parsed.source && !parsed.section && !parsed.category && !parsed.difficulty && !parsed.selectedAnswer && !parsed.correctAnswer && !parsed.timeSpent && !parsed.extractedNotes) {
        previewDiv.style.display = 'none';
        return;
    }

    previewDiv.style.display = 'block';
    badgesDiv.innerHTML = '';

    if (parsed.source) {
        // Assuming getSourceDisplayLabel is imported or logic inline
        // logic inline for now or import
        const label = parsed.source; // Simplification
        const sourceBadge = createBadge(`Source: ${label}`, 'green');
        if (questionLink.trim()) sourceBadge.innerHTML += ' <span style="margin-left:4px">📎</span>';
        badgesDiv.appendChild(sourceBadge);
    }
    if (parsed.section) {
        const sectionText = parsed.section === 'di' ? 'DI' : parsed.section.charAt(0).toUpperCase() + parsed.section.slice(1);
        badgesDiv.appendChild(createBadge(`Section: ${sectionText}`, 'default'));
    }
    if (parsed.category) badgesDiv.appendChild(createBadge(`Category: ${parsed.category}`, 'default'));
    if (parsed.difficulty) badgesDiv.appendChild(createBadge(`Difficulty: ${parsed.difficulty.charAt(0).toUpperCase() + parsed.difficulty.slice(1)}`, 'default'));

    if (parsed.selectedAnswer) {
        badgesDiv.appendChild(createBadge(`Selected: ${parsed.selectedAnswer}`, 'default'));
    }

    if (parsed.correctAnswer) {
        const isIncorrect = parsed.selectedAnswer && parsed.selectedAnswer !== parsed.correctAnswer;
        badgesDiv.appendChild(createBadge(`Correct: ${parsed.correctAnswer}`, isIncorrect ? 'red' : 'green'));
    }

    if (parsed.timeSpent) {
        badgesDiv.appendChild(createBadge(`Time: ${parsed.timeSpent}`, 'default'));
    }

    if (parsed.extractedNotes) {
        notesP.innerHTML = `<strong>Notes:</strong><br><pre style="white-space: pre-wrap; font-family: inherit; margin: 4px 0 0 0; font-size: inherit;">${parsed.extractedNotes}</pre>`;
        notesP.style.display = 'block';
    } else {
        notesP.style.display = 'none';
    }
}

// ============================================================================
// LOGIC FUNCTIONS (Moved from Extractor)
// ============================================================================

async function refreshData(root: ShadowRoot | Document, isAutoRefresh = false) {
    if (state.isRefreshing) return;
    state.isRefreshing = true;

    if (!state.extractQuestionFn) {
        if (!isAutoRefresh) showStatus('⚠️ No extractor available for this page', 'error', root);
        state.isRefreshing = false;
        return;
    }

    const notesTextarea = root.getElementById('gmat-notes') as HTMLTextAreaElement;
    const refreshBtn = root.getElementById('btn-refresh') as HTMLButtonElement;

    try {
        let originalIcon: string = '';
        if (!isAutoRefresh && refreshBtn) {
            originalIcon = refreshBtn.innerHTML;
            refreshBtn.innerHTML = ICONS.loader;
            refreshBtn.disabled = true;
        }

        const questionData = await state.extractQuestionFn();

        if (!questionData) {
            if (!isAutoRefresh) showStatus('⚠️ Could not extract data from page', 'error', root);
            if (!isAutoRefresh && refreshBtn) { // restore icon on failure
                refreshBtn.innerHTML = originalIcon || ICONS.refresh;
                refreshBtn.disabled = false;
            }
            return;
        }

        const currentNotes = notesTextarea ? notesTextarea.value : '';
        const questionLinkInput = root.getElementById('gmat-question-link') as HTMLInputElement;
        const parsed = parseNotesAndLink(currentNotes, questionLinkInput?.value || '', state.categories);

        let autoNotes = '';
        // ... Logic to build autoNotes (abridged for brevity, copying concept)
        if (questionData.questionType) {
            const qt = questionData.questionType.toLowerCase();
            if (qt === 'quant') autoNotes += 'quant';
            else if (qt === 'cr') autoNotes += 'verbal cr';
            else if (qt === 'rc') autoNotes += 'verbal rc';
            else if (qt === 'di') autoNotes += 'di';
        }
        if (questionData.category) {
            const cat = questionData.category.toLowerCase();
            const qt = (questionData.questionType || '').toLowerCase();
            if (cat !== qt && cat !== 'rc' && cat !== 'cr') {
                if (autoNotes) autoNotes += ' ';
                autoNotes += questionData.category;
            }
        }
        if (questionData.difficulty) {
            if (autoNotes) autoNotes += ' ';
            autoNotes += questionData.difficulty;
        }
        if (questionData.selectedAnswer) {
            if (autoNotes) autoNotes += ' ';
            autoNotes += `Selected:${questionData.selectedAnswer}`;
            if (questionData.correctAnswer) {
                autoNotes += ` Correct:${questionData.correctAnswer}`;
            }
        }
        if (questionData.timeSpent) {
            if (autoNotes) autoNotes += ' ';
            autoNotes += `Time:${questionData.timeSpent}`;
        }

        let customNotes = parsed.extractedNotes ? parsed.extractedNotes.trim() : '';
        let finalNotes = autoNotes;
        if (customNotes) {
            if (finalNotes) finalNotes += ' - ';
            finalNotes += customNotes;
        }
        if (finalNotes) finalNotes += '\n';

        if (notesTextarea) {
            notesTextarea.value = finalNotes;
            state.logData.notes = finalNotes;
            notesTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (!isAutoRefresh) showStatus('✓ Data refreshed from page', 'success', root);
        if (!isAutoRefresh && refreshBtn) {
            setTimeout(() => {
                refreshBtn.innerHTML = originalIcon || ICONS.refresh;
                refreshBtn.disabled = false;
            }, 300);
        }

    } catch (error) {
        console.error('Refresh error', error);
        if (!isAutoRefresh) showStatus('❌ Error refreshing data', 'error', root);
    } finally {
        state.isRefreshing = false;
    }
}

async function submitQuestionDataMain(root: ShadowRoot | Document) {
    if (state.isSubmitting) return;
    state.isSubmitting = true;

    const questionLinkInput = root.getElementById('gmat-question-link') as HTMLInputElement;
    const notesInput = root.getElementById('gmat-notes') as HTMLTextAreaElement;
    const submitBtn = root.getElementById('gmat-logger-submit') as HTMLButtonElement;

    const questionLink = questionLinkInput ? questionLinkInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!questionLink && !notes) {
        showStatus('Please enter either a question link or notes.', 'error', root);
        state.isSubmitting = false;
        return;
    }

    const parsed = parseNotesAndLink(notes, questionLink, state.categories);
    // Convert time
    let timeInSeconds = null;
    if (parsed.timeSpent) {
        const parts = parsed.timeSpent.split(':');
        if (parts.length === 2) {
            timeInSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
    }

    const payload: any = {
        question: questionLink || '',
        source: parsed.source || '',
        section: parsed.section || '',
        category: parsed.category || '',
        difficulty: parsed.difficulty || '',
        notes: parsed.extractedNotes || notes || '',
        status: 'Must Review',
        mistakeTypes: state.logData.tags || []
    };
    if (parsed.selectedAnswer) payload.selectedAnswer = parsed.selectedAnswer;
    if (timeInSeconds !== null) payload.timeSpent = timeInSeconds;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Extracting...';
    }

    try {
        if (state.extractQuestionFn) {
            const qData = await state.extractQuestionFn();
            if (qData) {
                if (qData.questionType && !payload.section) {
                    // Logic to infer section matches original
                    const qt = qData.questionType.toLowerCase();
                    if (qt === 'quant') payload.section = 'quant';
                    else if (qt === 'cr' || qt === 'rc') payload.section = 'verbal';
                    else if (qt === 'di') payload.section = 'di';
                }
                const enriched = enrichquestionData(qData, payload);
                payload.questionData = enriched;
            }
        }
        if (submitBtn) submitBtn.textContent = 'Adding...';

        await submitLog(payload);
        showStatus('Question logged successfully!', 'success', root);

        // Cleanup
        setTimeout(() => {
            state.logData = {
                url: getPracticeUrl(window.location.href),
                notes: '',
                tags: [],
                source: document.title
            };
            renderCurrentTab();
            setTimeout(() => {
                state.isCollapsed = true;
                updateSidebarLayout();
            }, 500);
        }, 1000);

    } catch (e: any) {
        console.error(e);
        // Check for auth error
        if (e.message === 'Authentication required' || e.code === 'AUTH_REQUIRED' || e.message === 'Session expired' || e.code === 'AUTH_EXPIRED') {
            // Try to authenticate
            showStatus('Authentication required. prompting...', 'default', root);
            try {
                const success = await authenticate();
                if (success) {
                    // Retry submission
                    showStatus('Authenticated! Retrying...', 'success', root);
                    await submitLog(payload);
                    showStatus('Question logged successfully!', 'success', root);

                    // Cleanup
                    setTimeout(() => {
                        state.logData = {
                            url: getPracticeUrl(window.location.href),
                            notes: '',
                            tags: [],
                            source: document.title
                        };
                        renderCurrentTab();
                        setTimeout(() => {
                            state.isCollapsed = true;
                            updateSidebarLayout();
                        }, 500);
                    }, 1000);
                    return; // Exit success path
                } else {
                    showStatus('Authentication failed or cancelled.', 'error', root);
                }
            } catch (authErr) {
                showStatus('Authentication failed.', 'error', root);
            }
        } else {
            showStatus('Error: ' + e.message, 'error', root);
        }
    } finally {
        state.isSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Quick Add';
        }
    }
}


// ============================================================================
// SIDEBAR UI & LAYOUT
// ============================================================================

let sidebarContainer: HTMLElement;
let shadow: ShadowRoot;
let container: HTMLElement;

function renderCurrentTab() {
    // Determine which render function to call based on state.activeTab
    // For now simple implementation
    if (!container) return;

    // ... Implement render logic similar to original ...
    // Calling render() basically
    render();
}

function updateSidebarLayout() {
    if (state.isCollapsed) {
        sidebarContainer.style.transform = 'translateX(100%)';
        document.body.style.marginRight = '0px';
        const expandBtn = document.getElementById('smartlog-expand-button');
        if (expandBtn) expandBtn.style.display = 'block';
    } else {
        sidebarContainer.style.transform = 'translateX(0)';
        sidebarContainer.style.width = `${state.sidebarWidth}px`;
        document.body.style.marginRight = `${state.sidebarWidth}px`;
        const expandBtn = document.getElementById('smartlog-expand-button');
        if (expandBtn) expandBtn.style.display = 'none';

        if (state.activeTab === 'log') {
            setTimeout(() => {
                const notes = shadow.getElementById('gmat-notes') as HTMLTextAreaElement;
                if (notes) {
                    notes.focus();
                    notes.setSelectionRange(notes.value.length, notes.value.length);
                }
            }, 350);
        }
    }
}

function renderLogTab(parent: HTMLElement, root: ShadowRoot) {
    parent.innerHTML = '';
    const qLink = state.logData.url || getPracticeUrl(window.location.href);
    const notes = state.logData.notes || '';

    const div = document.createElement('div');
    div.innerHTML = `
        <div class="space-y-2">
            <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.link} Question Link</label>
            <input id="gmat-question-link" type="text" value="${qLink}" class="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
        </div>
        <div class="space-y-2 mt-4">
             <div class="flex items-center justify-between">
                <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.fileText} Smart Notes</label>
                <button id="btn-refresh" class="text-gray-400 hover:text-blue-600 transition p-1 flex items-center gap-1 text-xs font-medium" title="Refresh data from page">
                    ${ICONS.refresh}
                    <span class="hidden sm:inline">Refresh</span>
                </button>
             </div>
             <div class="relative">
                <textarea id="gmat-notes" placeholder="Type: weaken hard - my mistake was..." class="w-full p-3 border border-gray-300 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-gray-700 leading-relaxed">${notes}</textarea>
                <div id="gmat-suggestions" style="position:absolute;z-index:10;width:100%;margin-top:1px;background:white;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:none"></div>
             </div>
             <p class="text-xs text-gray-500">💡 Click refresh to update after revealing answer. Or type keywords: <code class="bg-gray-100 px-1.5 py-0.5 rounded">weaken</code>, <code class="bg-gray-100 px-1.5 py-0.5 rounded">hard</code> and press Tab.</p>
        </div>
        <div class="space-y-3 mt-4">
            <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">${ICONS.tag} Mistake Tags</label>
            <div id="gmat-tags-list" class="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar"></div>
        </div>
        <div id="gmat-parsed-preview" style="background:rgba(156,163,175,0.1);padding:16px;border-radius:8px;display:none;margin-top:16px;">
            <h4 class="font-medium text-sm text-gray-600 mb-2">Parsed Information:</h4>
            <div id="gmat-parsed-badges" class="flex flex-wrap gap-2"></div>
            <p id="gmat-parsed-notes" style="font-size:12px;color:#6b7280;margin:8px 0 0 0;display:none;max-height:200px;overflow-y:auto" class="custom-scrollbar"></p>
        </div>
    `;
    parent.appendChild(div);
}

function renderSettings(parent: HTMLElement) {
    const container = document.createElement('div');
    container.className = 'space-y-6';
    container.innerHTML = `
        <div class="space-y-4">
            <label class="text-sm font-semibold text-gray-700">Gemini API Key</label>
            <div class="flex gap-2">
                <input type="password" id="gemini-api-key" class="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Enter your API key">
                <button id="toggle-api-key" class="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition" title="Toggle Visibility">
                    ${ICONS.eye}
                </button>
            </div>
            <div class="text-xs text-gray-500">
                Required for AI analysis features. Key is stored locally in your browser.
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Get API Key</a>
            </div>
        </div>

        <div class="space-y-4">
            <label class="text-sm font-semibold text-gray-700">Authentication</label>
            <div id="auth-status-container">
                <!-- Will be populated by updateAuthUI -->
            </div>
        </div>

        <div>
            <button id="save-settings" class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">Save Settings</button>
        </div>
    `;

    // Load saved key
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        const input = container.querySelector('#gemini-api-key') as HTMLInputElement;
        if (input) input.value = savedKey;
    }

    // Toggle visibility
    const toggleBtn = container.querySelector('#toggle-api-key');
    const input = container.querySelector('#gemini-api-key') as HTMLInputElement;
    if (toggleBtn && input) {
        toggleBtn.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.innerHTML = ICONS.eyeOff;
            } else {
                input.type = 'password';
                toggleBtn.innerHTML = ICONS.eye;
            }
        });
    }

    // Save settings
    const saveBtn = container.querySelector('#save-settings');
    if (saveBtn && input) {
        saveBtn.addEventListener('click', () => {
            const key = input.value.trim();
            if (key) {
                localStorage.setItem('gemini_api_key', key);
                state.apiKey = key;
                showStatus('Settings saved', 'success', container.getRootNode() as ShadowRoot);
            }
        });
    }

    parent.appendChild(container);

    // Update auth UI initially
    updateAuthUI(container);
}

async function updateAuthUI(container: HTMLElement) {
    const authContainer = container.querySelector('#auth-status-container');
    if (!authContainer) return;

    const isAuthenticated = await hasValidToken();
    if (isAuthenticated) {
        authContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span class="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">● Signed In</span>
                <button id="btn-logout" class="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Sign Out</button>
            </div>
            <div class="text-xs text-gray-500">Session active. You can save logs to your account.</div>
        `;

        const logoutBtn = container.querySelector('#btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                clearToken();
                showStatus('Signed out successfully', 'success', container.getRootNode() as ShadowRoot);
                updateAuthUI(container);
                updateHeaderAuthIcon(container.getRootNode() as ShadowRoot);
            });
        }
    } else {
        authContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span class="inline-block px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">○ Not Signed In</span>
                <button id="btn-login" class="px-3 py-1 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">Sign In</button>
            </div>
            <div class="text-xs text-gray-500">Sign in to save logs to your account.</div>
        `;

        const loginBtn = container.querySelector('#btn-login');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                showStatus('Opening login popup...', 'default', container.getRootNode() as ShadowRoot);
                const success = await authenticate();
                if (success) {
                    showStatus('Signed in successfully!', 'success', container.getRootNode() as ShadowRoot);
                    updateAuthUI(container);
                    updateHeaderAuthIcon(container.getRootNode() as ShadowRoot);
                } else {
                    showStatus('Sign in failed or cancelled', 'error', container.getRootNode() as ShadowRoot);
                }
            });
        }
    }
}

async function updateHeaderAuthIcon(root: ShadowRoot) {
    const authStatusDiv = root.getElementById('header-auth-status');
    if (authStatusDiv) {
        const isAuthenticated = await hasValidToken();
        if (isAuthenticated) {
            authStatusDiv.innerHTML = `<span class="text-green-500" title="Signed In">${ICONS.checkCircle}</span>`;
        } else {
            authStatusDiv.innerHTML = `<span class="text-gray-400" title="Not Signed In">${ICONS.user}</span>`;
        }
    }
}

function renderAiTab(parent: HTMLElement) {
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
        if (analysis.detectedSource) state.logData.source = analysis.detectedSource;
    } catch (error) {
        console.error('Analysis failed:', error);
        alert('Analysis failed. Check console.');
    } finally {
        state.isAnalyzing = false;
        render();
    }
}

async function analyzeContent(text: string) {
    const prompt = `Analyze this test prep question:
"""
${text}
"""
Return JSON: { summary, reasoning, suggestedTags[], detectedSource, difficulty }`;
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

// ============================================================================
// LOGIN SCREEN
// ============================================================================

function renderLoginScreen(parent: HTMLElement) {
    const loginContainer = document.createElement('div');
    loginContainer.className = 'flex flex-col items-center justify-center p-12 text-center';
    loginContainer.style.minHeight = '400px';
    
    loginContainer.innerHTML = `
        <div class="mb-6 text-6xl">${ICONS.lock || '🔒'}</div>
        <h2 class="text-2xl font-bold text-gray-800 mb-3">Authentication Required</h2>
        <p class="text-gray-600 mb-8 max-w-md">
            Please sign in to access GMAT Logger. You'll be able to log questions, track your progress, and use AI assistance.
        </p>
        <button id="btn-signin" class="px-8 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all">
            Sign In
        </button>
    `;
    
    parent.appendChild(loginContainer);
}

function attachLoginEvents(root: ShadowRoot) {
    // Close button
    root.getElementById('btn-close')?.addEventListener('click', () => {
        const sidebar = document.getElementById('smartlog-split-container');
        if (sidebar) sidebar.remove();
        const expandBtn = document.getElementById('smartlog-expand-button');
        if (expandBtn) expandBtn.remove();
        (window as any).__SMARTLOG_INJECTED__ = false;
    });
    
    // Sign In button
    root.getElementById('btn-signin')?.addEventListener('click', async () => {
        const btn = root.getElementById('btn-signin') as HTMLButtonElement;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Signing in...';
        }
        
        try {
            const success = await authenticate();
            if (success) {
                // Re-render the sidebar with authenticated view
                await render();
            } else {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Sign In';
                }
                alert('Authentication failed. Please try again.');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
            alert('Authentication failed. Please try again.');
        }
    });
}

async function render() {
    container.innerHTML = '';
    
    // Check authentication status
    const isAuthenticated = await hasValidToken();
    
    // Header
    const header = document.createElement('div');
    header.className = "p-4 border-b border-gray-200 flex justify-between items-center bg-white";
    header.innerHTML = `
        <div class="flex items-center space-x-2 text-gray-800">
            <div class="bg-yellow-100 p-1.5 rounded-md">${ICONS.zap}</div>
            <h2 class="font-bold text-lg">Smart Log</h2>
        </div>
        <div class="flex items-center gap-2">
            <button id="btn-refresh" class="text-gray-400 hover:text-blue-600 transition p-1" title="Refresh data from page">
                ${ICONS.refresh}
            </button>
            <button id="btn-settings" class="text-gray-400 hover:text-gray-600 transition p-1" title="Settings">
                ${ICONS.settings}
            </button>
            <button id="btn-close" class="text-gray-400 hover:text-gray-600 transition p-1" title="Close Sidebar">
                ${ICONS.x}
            </button>
        </div>
    `;
    container.appendChild(header);
    
    // If not authenticated, show login screen
    if (!isAuthenticated) {
        renderLoginScreen(container);
        attachLoginEvents(shadow);
        return;
    }

    // Tabs or Settings Header
    if (state.activeTab !== 'settings') {
        const tabs = document.createElement('div');
        tabs.className = "flex border-b border-gray-200";
        tabs.innerHTML = `
            <button id="tab-log" class="flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${state.activeTab === 'log' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
                Smart Log
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

    // Content
    const content = document.createElement('div');
    content.className = "flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar";
    
    if (state.activeTab === 'settings') {
        renderSettings(content);
    } else if (state.activeTab === 'log') {
        renderLogTab(content, shadow);
    } else {
        renderAiTab(content);
    }
    container.appendChild(content);

    // Footer (only for non-settings tabs)
    if (state.activeTab !== 'settings') {
        const footer = document.createElement('div');
        footer.className = "border-t border-gray-200 bg-gray-50";
        footer.innerHTML = `
            <div id="gmat-logger-status" style="display:none;margin:12px 16px 0 16px;padding:12px;border-radius:6px;font-size:14px;font-weight:500;text-align:center;"></div>
            <div class="p-4 flex justify-end space-x-3">
                <button id="btn-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-300 rounded-lg transition">Cancel</button>
                <button id="${state.activeTab === 'log' ? 'gmat-logger-submit' : 'btn-save'}" class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition">Quick Add</button>
            </div>
        `;
        container.appendChild(footer);
    }

    attachEvents(shadow);
}

function attachEvents(root: ShadowRoot) {
    // Close button
    root.getElementById('btn-close')?.addEventListener('click', () => {
        const sidebar = document.getElementById('smartlog-split-container');
        if (sidebar) sidebar.remove();
        const expandBtn = document.getElementById('smartlog-expand-button');
        if (expandBtn) expandBtn.remove();
        (window as any).__SMARTLOG_INJECTED__ = false;
    });
    
    // Settings button
    root.getElementById('btn-settings')?.addEventListener('click', () => {
        state.activeTab = 'settings';
        render();
    });
    
    // Refresh button (in header)
    root.getElementById('btn-refresh')?.addEventListener('click', () => {
        refreshData(root);
    });
    
    // Tab buttons
    root.getElementById('tab-log')?.addEventListener('click', () => {
        state.activeTab = 'log';
        render();
    });
    
    root.getElementById('tab-ai')?.addEventListener('click', () => {
        state.activeTab = 'ai';
        render();
    });
    
    // Back from settings
    root.getElementById('back-from-settings')?.addEventListener('click', () => {
        state.activeTab = 'log';
        render();
    });
    
    // AI tab buttons
    root.getElementById('btn-run-analysis')?.addEventListener('click', handleAnalysis);
    root.getElementById('btn-review-log')?.addEventListener('click', () => {
        state.activeTab = 'log';
        render();
    });
    
    // Footer buttons
    root.getElementById('btn-cancel')?.addEventListener('click', () => {
        state.isCollapsed = true;
        updateSidebarLayout();
    });
    
    root.getElementById('gmat-logger-submit')?.addEventListener('click', () => {
        submitQuestionDataMain(root);
    });

    // Log Tab Events
    if (state.activeTab === 'log') {
        const questionLinkInput = root.getElementById('gmat-question-link') as HTMLInputElement;
        const notesTextarea = root.getElementById('gmat-notes') as HTMLTextAreaElement;
        const tagsList = root.getElementById('gmat-tags-list');
        const suggestionsDiv = root.getElementById('gmat-suggestions');

        if (notesTextarea && suggestionsDiv) {
            let cursorPosition = 0;
            // Autocomplete logic
            notesTextarea.addEventListener('input', (e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                cursorPosition = target.selectionStart;
                const parsed = parseNotesAndLink(target.value, questionLinkInput?.value || '', state.categories);
                const suggs = getAutoSuggestions(target.value, cursorPosition, parsed, state.categories);
                        
                if (suggs.length > 0) {
                    suggestionsDiv.style.display = 'block';
                    suggestionsDiv.innerHTML = suggs.map(s => `<button type="button" class="suggestion-item" style="width:100%;padding:12px 16px;text-align:left;background:rgba(156,163,175,0.1);border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:14px"><span style="font-weight:500">${s.fullName}</span><span style="color:#6b7280;font-size:12px">Tab</span></button>`).join('');
                    suggestionsDiv.querySelectorAll('.suggestion-item').forEach((item, idx) => {
                        item.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const suggestion = suggs[idx];
                            const applied = applySuggestion(target.value, suggestion, cursorPosition);
                            target.value = applied.newInput;
                            target.focus();
                            suggestionsDiv.style.display = 'none';
                            // Update parsed preview after applying suggestion
                            state.logData.notes = target.value;
                            updateParsedPreview(questionLinkInput?.value || '', target.value, root);
                        });
                    });
                } else {
                    suggestionsDiv.style.display = 'none';
                }
                state.logData.notes = target.value;
                updateParsedPreview(questionLinkInput?.value || '', target.value, root);
            });
                    
            // Track cursor position on keyup
            notesTextarea.addEventListener('keyup', (e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                cursorPosition = target.selectionStart;
            });
                    
            // Track cursor position and show suggestions on click
            notesTextarea.addEventListener('click', (e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                cursorPosition = target.selectionStart;
                const parsed = parseNotesAndLink(target.value, questionLinkInput?.value || '', state.categories);
                const suggs = getAutoSuggestions(target.value, cursorPosition, parsed, state.categories);
                        
                if (suggs.length > 0) {
                    suggestionsDiv.style.display = 'block';
                    suggestionsDiv.innerHTML = suggs.map(s => `<button type="button" class="suggestion-item" style="width:100%;padding:12px 16px;text-align:left;background:rgba(156,163,175,0.1);border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:14px"><span style="font-weight:500">${s.fullName}</span><span style="color:#6b7280;font-size:12px">Tab</span></button>`).join('');
                    suggestionsDiv.querySelectorAll('.suggestion-item').forEach((item, idx) => {
                        item.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const suggestion = suggs[idx];
                            const applied = applySuggestion(target.value, suggestion, cursorPosition);
                            target.value = applied.newInput;
                            target.focus();
                            suggestionsDiv.style.display = 'none';
                            // Update parsed preview after applying suggestion
                            state.logData.notes = target.value;
                            updateParsedPreview(questionLinkInput?.value || '', target.value, root);
                        });
                    });
                }
            });
            
            // Keyboard navigation for suggestions
            notesTextarea.addEventListener('keydown', (e) => {
                e.stopPropagation();
                cursorPosition = (e.target as HTMLTextAreaElement).selectionStart;
                const suggs = getAutoSuggestions(notesTextarea.value, cursorPosition, parseNotesAndLink(notesTextarea.value, questionLinkInput?.value || '', state.categories), state.categories);
                
                if (suggs.length > 0) {
                    switch (e.key) {
                        case 'Tab':
                        case 'Enter':
                            e.preventDefault();
                            const suggestion = suggs[0];
                            const applied = applySuggestion(notesTextarea.value, suggestion, cursorPosition);
                            notesTextarea.value = applied.newInput;
                            suggestionsDiv.style.display = 'none';
                            state.logData.notes = notesTextarea.value;
                            setTimeout(() => updateParsedPreview(questionLinkInput?.value || '', notesTextarea.value, root), 0);
                            break;
                        case 'Escape':
                            suggestionsDiv.style.display = 'none';
                            break;
                    }
                }
            });
            
            // Hide suggestions on blur
            notesTextarea.addEventListener('blur', () => {
                setTimeout(() => suggestionsDiv.style.display = 'none', 150);
            });
        }
        
        // Question link events
        if (questionLinkInput) {
            questionLinkInput.addEventListener('keydown', (e) => {
                e.stopPropagation();
            });
            questionLinkInput.addEventListener('input', () => {
                updateParsedPreview(questionLinkInput.value, notesTextarea?.value || '', root);
                state.logData.url = questionLinkInput.value;
            });
        }
        
        // Tags list setup
        if (tagsList) {
            fetchTags().then(fetchedTags => {
                state.allTags = fetchedTags;
                renderTagList(tagsList, root);
            });
        }
        
        updateParsedPreview(questionLinkInput?.value || '', notesTextarea?.value || '', root);
    }
}

function renderTagList(tagsList: HTMLElement, root: ShadowRoot) {
    tagsList.innerHTML = '';
    const tags = state.logData.tags || [];

    state.allTags.forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const btn = document.createElement('button');
        const isActive = tags.includes(tagName);
        btn.className = `px-3 py-1 rounded-full text-xs border transition-all ${isActive ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`;
        btn.textContent = tagName;
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTag(tagName, tagsList, root);
        };
        tagsList.appendChild(btn);
    });
}

function toggleTag(tag: string, tagsList: HTMLElement, root: ShadowRoot) {
    const tags = state.logData.tags || [];
    if (tags.includes(tag)) {
        state.logData.tags = tags.filter(t => t !== tag);
    } else {
        state.logData.tags = [...tags, tag];
    }
    renderTagList(tagsList, root);
}

export async function createSidebar() {
    if ((window as any).__SMARTLOG_INJECTED__) {
        alert('Sidebar already open');
        return;
    }
    (window as any).__SMARTLOG_INJECTED__ = true;
    
    sidebarContainer = document.createElement('div');
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

    // Expand Button (for collapsed state)
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
        updateSidebarLayout();
    };

    // Assemble
    sidebarContainer.appendChild(resizeHandle);
    sidebarContainer.appendChild(contentArea);
    document.body.appendChild(sidebarContainer);
    document.body.appendChild(expandButton);

    // Adjust Body Margin
    const originalBodyTransition = document.body.style.transition;
    document.body.style.transition = 'margin-right 0.3s ease-in-out';

    updateSidebarLayout();
    updateSidebarLayout();

    // Resize Logic
    let isResizing = false;
    let startX: number, startWidth: number;

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
            sidebarContainer.style.transition = 'transform 0.2s ease-in-out';
            document.body.style.transition = 'margin-right 0.2s ease-in-out';
        }
    });

    // Shadow DOM & Styles
    shadow = contentArea.attachShadow({ mode: 'open' });
    // Add Tailwind or styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';

    // Check if running in extension context
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        link.href = chrome.runtime.getURL('tailwind.min.css');
    } else {
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css';
    }

    shadow.appendChild(link);

    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);

    const style = document.createElement('style');
    style.textContent = `
    /* Custom Scrollbar */
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
    
    /* Base Styles */
    :host { font-family: 'Open Sans', sans-serif; color: #1e293b; }
    * { box-sizing: border-box; }
    button:disabled { opacity: 0.7; cursor: not-allowed; }
    input:focus, textarea:focus { ring: 2px; ring-color: #3b82f6; border-color: #3b82f6; }
    
    /* Transition for toggle */
    #smartlog-split-container { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  `;
    shadow.appendChild(style);

    container = document.createElement('div');
    container.className = "bg-white h-full flex flex-col text-gray-800 font-sans";
    shadow.appendChild(container);

    // Keyboard Shortcut: Ctrl+L (Cmd+L on Mac)
    document.addEventListener('keydown', (e) => {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const isLKey = e.key === 'l' || e.key === 'L';

        if (isCtrlOrCmd && isLKey) {
            e.preventDefault();
            state.isCollapsed = !state.isCollapsed;
            updateSidebarLayout();
            console.log(`[SmartLog] Sidebar ${state.isCollapsed ? 'collapsed' : 'expanded'} via keyboard shortcut`);
        }
    });

    // Slide in animation
    requestAnimationFrame(() => {
        sidebarContainer.style.transform = 'translateX(0)';
        document.body.style.marginRight = `${state.sidebarWidth}px`;
    });

    render();
    updateHeaderAuthIcon(shadow);

    // Fetch data after render
    try {
        const categories = await fetchCategories();
        state.categories = categories; // Store in state!
        
        const tags = await fetchTags();
        state.allTags = tags; // Store in state!
        
        console.log('[Sidebar] Categories loaded:', state.categories.length);
        console.log('[Sidebar] Tags loaded:', state.allTags.length);
    } catch (e: any) {
        if (e.message === 'Authentication required' || e.code === 'AUTH_REQUIRED') {
            console.warn('Initial fetch: Authentication required (User needs to sign in)');
            // We can prompt for auth or just show a status
            showStatus('Please sign in to load categories.', 'error', shadow);
        } else {
            console.warn('Initial fetch failed:', e);
            showStatus('Failed to load data. ' + e.message, 'error', shadow);
        }
    }
    
    // Auto-extract question data on initial load if extractor is available
    if (state.extractQuestionFn) {
        console.log('[Sidebar] Auto-populate: Extractor available, attempting to extract...');
        // Use setTimeout to ensure DOM is ready
        setTimeout(async () => {
            if (state.isInitialLoad) {
                console.log('[Sidebar] Initial load detected, auto-extracting question data...');
                state.isInitialLoad = false;
                await refreshData(shadow, true); // true = isAutoRefresh (silent mode)
            }
        }, 100); // Match original timing
    } else {
        console.log('[Sidebar] Auto-populate: No extractor available for this page');
        state.isInitialLoad = false;
    }
}

// Global declaration
declare global {
    interface Window {
        __SMARTLOG_INJECTED__: boolean;
    }
}
