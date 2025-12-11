(function () {
    'use strict';

    // Create popup immediately
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 800px;
        max-height: 80vh;
        overflow: auto;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        min-width: 400px;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Extracting TTP CR Data...';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #333;
        font-size: 20px;
    `;

    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
        text-align: center;
        padding: 40px 20px;
    `;

    const timerDisplay = document.createElement('div');
    timerDisplay.style.cssText = `
        font-size: 48px;
        font-weight: bold;
        color: #007bff;
        margin-bottom: 20px;
        font-family: monospace;
    `;
    timerDisplay.textContent = '0.0s';

    const statusMessage = document.createElement('div');
    statusMessage.style.cssText = `
        font-size: 16px;
        color: #666;
    `;
    statusMessage.textContent = 'Processing...';

    contentArea.appendChild(timerDisplay);
    contentArea.appendChild(statusMessage);

    popup.appendChild(title);
    popup.appendChild(contentArea);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Start timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        timerDisplay.textContent = elapsed.toFixed(1) + 's';
    }, 100);

    function extractTTPCRData() {
        try {
            const data = {
                questionType: null,
                result: null,
                timeSpent: null,
                selectedAnswer: null,
                correctAnswer: null,
                stimulus: null,
                question: null,
                answerChoices: []
            };

            // 1. Extract Question Type
            const questionTypeSpan = document.querySelector('.text-truncate');
            if (questionTypeSpan) {
                data.questionType = questionTypeSpan.textContent.trim();
            }

            // 2. Extract Result (Correct/Incorrect)
            const correctIcon = document.querySelector('.circled-icon-16.correct');
            const incorrectIcon = document.querySelector('.circled-icon-16.incorrect');
            if (correctIcon && !correctIcon.classList.contains('user-choice')) {
                data.result = 'Correct';
            } else if (incorrectIcon) {
                data.result = 'Incorrect';
            }

            // 3. Extract Time Spent
            const questionTimeDiv = document.querySelector('.question-time');
            if (questionTimeDiv) {
                const timeSpan = questionTimeDiv.querySelector('span.data');
                if (timeSpan) {
                    data.timeSpent = timeSpan.textContent.trim();
                }
            }

            // 4. Extract Selected Answer
            const userChoiceInput = document.querySelector('input.user-choice');
            if (userChoiceInput) {
                const answerValue = parseInt(userChoiceInput.value);
                const answerLetter = String.fromCharCode(65 + answerValue); // 0->A, 1->B, etc.
                data.selectedAnswer = `${answerLetter}`;
            }

            // 5. Extract Correct Answer
            const correctInput = document.querySelector('input.correct[data-correct="true"]');
            if (correctInput) {
                const answerValue = parseInt(correctInput.value);
                const answerLetter = String.fromCharCode(65 + answerValue); // 0->A, 1->B, etc.
                data.correctAnswer = `${answerLetter}`;
            }

            // 6. Extract Stimulus and Question
            const exerciseStem = document.querySelector('.exercise-stem');
            if (exerciseStem) {
                const paragraphs = exerciseStem.querySelectorAll('p');
                if (paragraphs.length > 1) {
                    // Last paragraph is usually the question
                    const questionParagraphs = Array.from(paragraphs);
                    const lastP = questionParagraphs.pop();
                    data.question = lastP.textContent.trim();

                    // Remaining paragraphs are the stimulus
                    data.stimulus = questionParagraphs.map(p => p.textContent.trim()).join('\n\n');
                } else if (paragraphs.length === 1) {
                    data.stimulus = paragraphs[0].textContent.trim();
                }
            }

            // 7. Extract Answer Choices
            const answersDiv = document.querySelector('.answers');
            if (answersDiv) {
                const answerDivs = answersDiv.querySelectorAll('.answer');
                answerDivs.forEach((answerDiv) => {
                    const optionSpan = answerDiv.querySelector('span.option');
                    if (optionSpan) {
                        const noteSpan = optionSpan.querySelector('.notetaking-preselection');
                        if (noteSpan) {
                            data.answerChoices.push(noteSpan.textContent.trim());
                        }
                    }
                });
            }

            return data;
        } catch (error) {
            console.error('Error extracting TTP CR data:', error);
            return null;
        }
    }

    function showResults(extractedData, elapsedTime) {
        // Stop timer
        clearInterval(timerInterval);

        if (!extractedData) {
            title.textContent = 'Extraction Failed';
            contentArea.innerHTML = `
                <div style="color: #dc3545; font-size: 16px;">
                    Failed to extract TTP CR data. Please check the console for errors.
                </div>
            `;
            return;
        }

        // Format as JSON
        const jsonOutput = JSON.stringify(extractedData, null, 2);

        // Update popup with results
        title.textContent = 'TTP CR Data Extraction Result';
        title.style.color = '#28a745';

        contentArea.style.cssText = '';
        contentArea.innerHTML = '';

        const timeInfo = document.createElement('div');
        timeInfo.style.cssText = `
            background: #e7f3ff;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
            color: #0066cc;
        `;
        timeInfo.textContent = `✓ Extraction completed in ${elapsedTime.toFixed(2)}s`;

        const pre = document.createElement('pre');
        pre.style.cssText = `
            background: #f5f5f5;
            padding: 15px;
            border-radius: 4px;
            overflow: auto;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            text-align: left;
        `;
        pre.textContent = jsonOutput;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            margin-top: 15px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        `;

        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy to Clipboard';
        copyButton.style.cssText = `
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        copyButton.onclick = () => {
            navigator.clipboard.writeText(jsonOutput).then(() => {
                copyButton.textContent = 'Copied!';
                copyButton.style.background = '#28a745';
                setTimeout(() => {
                    copyButton.textContent = 'Copy to Clipboard';
                    copyButton.style.background = '#007bff';
                }, 2000);
            });
        };

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            padding: 8px 16px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        closeButton.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(closeButton);

        contentArea.appendChild(timeInfo);
        contentArea.appendChild(pre);
        contentArea.appendChild(buttonContainer);

        // Also log to console
        console.log('TTP CR Extracted Data:', extractedData);
        console.log('JSON:', jsonOutput);
    }

    // Perform extraction after a small delay to ensure popup is visible
    setTimeout(() => {
        const extractedData = extractTTPCRData();
        const elapsedTime = (Date.now() - startTime) / 1000;
        showResults(extractedData, elapsedTime);
    }, 100);
})();
