/**
 * GMAT Hero Auto-Answer Script with UI Controls
 * 
 * Automates the following process:
 * 1. Selects "Option 1" (radio button with id="option1")
 * 2. Clicks the "Next" button
 * 3. Clicks "Yes" to confirm
 * 4. Repeats the process with a 1-second delay
 * 
 * Features:
 * - Floating UI with Start, Pause, and Stop buttons
 * - Status indicator
 */

(function () {
    // State variables
    let isRunning = false;
    let isPaused = false;
    let timerId = null;

    // Create UI
    function createUI() {
        // Remove existing UI if present
        const existingUI = document.getElementById('gmat-auto-answer-ui');
        if (existingUI) existingUI.remove();

        const container = document.createElement('div');
        container.id = 'gmat-auto-answer-ui';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: sans-serif;
            min-width: 200px;
        `;

        const title = document.createElement('div');
        title.textContent = 'Auto-Answer Control';
        title.style.cssText = 'font-weight: bold; margin-bottom: 10px; text-align: center; color: #333;';
        container.appendChild(title);

        const status = document.createElement('div');
        status.id = 'gmat-status';
        status.textContent = 'Status: Ready';
        status.style.cssText = 'margin-bottom: 10px; font-size: 12px; color: #666; text-align: center;';
        container.appendChild(status);

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

        // Start Button
        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start';
        startBtn.style.cssText = 'padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;';
        startBtn.onclick = startScript;
        btnContainer.appendChild(startBtn);

        // Pause Button
        const pauseBtn = document.createElement('button');
        pauseBtn.textContent = 'Pause';
        pauseBtn.style.cssText = 'padding: 5px 10px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;';
        pauseBtn.onclick = pauseScript;
        btnContainer.appendChild(pauseBtn);

        // Stop Button
        const stopBtn = document.createElement('button');
        stopBtn.textContent = 'Stop';
        stopBtn.style.cssText = 'padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;';
        stopBtn.onclick = stopScript;
        btnContainer.appendChild(stopBtn);

        container.appendChild(btnContainer);
        document.body.appendChild(container);
    }

    function updateStatus(text, color = '#666') {
        const statusEl = document.getElementById('gmat-status');
        if (statusEl) {
            statusEl.textContent = `Status: ${text}`;
            statusEl.style.color = color;
        }
    }

    function startScript() {
        if (isRunning && !isPaused) return; // Already running

        isRunning = true;
        isPaused = false;
        updateStatus('Running...', '#28a745');
        console.log('Auto-answer script started/resumed.');
        processStep();
    }

    function pauseScript() {
        if (!isRunning) return;
        isPaused = true;
        updateStatus('Paused', '#ffc107');
        console.log('Auto-answer script paused.');
        if (timerId) clearTimeout(timerId);
    }

    function stopScript() {
        isRunning = false;
        isPaused = false;
        if (timerId) clearTimeout(timerId);
        updateStatus('Stopped', '#dc3545');
        console.log('Auto-answer script stopped.');
    }

    function processStep() {
        if (!isRunning || isPaused) return;

        console.log('--- Starting new iteration ---');

        // 1. Select Option 1
        const option1 = document.getElementById('option1');
        if (option1) {
            option1.click();
            console.log('Selected Option 1');
        } else {
            console.warn('Option 1 (#option1) not found.');
        }

        // Small delay to allow UI state to update
        timerId = setTimeout(() => {
            if (!isRunning || isPaused) return;

            // 2. Click "Next" button
            const buttons = Array.from(document.querySelectorAll('button'));
            const nextBtn = buttons.find(b => b.textContent && b.textContent.includes('Next'));

            if (nextBtn) {
                nextBtn.click();
                console.log('Clicked "Next" button');

                // 3. Click "Yes" to confirm
                timerId = setTimeout(() => {
                    if (!isRunning || isPaused) return;

                    const buttonsAfterNext = Array.from(document.querySelectorAll('button'));
                    const yesBtn = buttonsAfterNext.find(b => b.textContent && b.textContent.trim() === 'Yes');

                    if (yesBtn) {
                        yesBtn.click();
                        console.log('Clicked "Yes" button');
                    } else {
                        console.log('"Yes" button not found. Skipping confirmation step.');
                    }

                    // 4. Wait 1s before next iteration
                    updateStatus('Waiting 1s...', '#17a2b8');
                    timerId = setTimeout(() => {
                        if (isRunning && !isPaused) {
                            updateStatus('Running...', '#28a745');
                            processStep();
                        }
                    }, 1000);

                }, 500); // Wait 500ms for "Yes" button to appear
            } else {
                console.error('"Next" button not found. Stopping script.');
                updateStatus('Error: Next btn not found', 'red');
                isRunning = false;
            }
        }, 500); // Wait 500ms after selecting option
    }

    // Initialize
    createUI();
    console.log('GMAT Auto-Answer Script loaded. Use the UI in the bottom-right corner.');
})();
