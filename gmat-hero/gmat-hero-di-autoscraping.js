
javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT DI Extractor", "width=600,height=400,scrollbars=yes");

    // Global variables
    var extractedQuestions = [];
    var isRunning = false;

    /**
     * Helper: Wait for ms milliseconds
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Decode HTML entities
     */
    function decodeHtmlEntities(text) {
        var textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
    }

    /**
     * Get practice URL
     */
    function getPracticeUrl() {
        var currentUrl = window.location.href;
        return currentUrl.replace('/review/', '/practice/');
    }

    /**
     * Extract metadata (Category, Difficulty, Correct Answer, etc.)
     */
    function extractGMATHeroMetadata() {
        var metadata = {
            isReviewMode: false,
            category: "di",
            selectedAnswer: null,
            difficulty: null,
            timeSpent: null,
            correctAnswer: null
        };

        // 1. Check review mode
        var reviewModeEl = document.querySelector('.review-mode');
        metadata.isReviewMode = !!reviewModeEl;

        // 2. Extract difficulty
        var levelBadgeEl = document.querySelector('.level-badge');
        if (levelBadgeEl) {
            var difficultyText = levelBadgeEl.textContent.trim();
            var difficultyNum = parseInt(difficultyText, 10);
            if (!isNaN(difficultyNum)) {
                if (difficultyNum < 600) metadata.difficulty = 'easy';
                else if (difficultyNum < 700) metadata.difficulty = 'medium';
                else metadata.difficulty = 'hard';
            }
        }

        // 3. Time spent
        var clockIcon = document.querySelector('.pi-clock');
        if (clockIcon && clockIcon.nextElementSibling) {
            metadata.timeSpent = clockIcon.nextElementSibling.textContent.trim();
        }

        // Note: For DI Dropdowns, "Correct Answer" logic is complex because there are multiple inputs.
        // The standard metadata extractor is for single-choice Quant/Verbal.
        // We might capture the correct answers from the dropdowns if revealed?
        // In GMAT Hero, after answering, the correct options are usually shown or marked green.
        // We can inspect the dropdowns during extraction to see which one is correct.

        return metadata;
    }

    /**
     * Main Extraction Function (Async)
     */
    async function extractQuestionData() {
        try {
            var rightPanel = document.getElementById('right-panel');
            if (!rightPanel) {
                console.warn("No right panel found");
                return null;
            }

            var questionStem = rightPanel.querySelector('.question-stem');
            if (!questionStem) {
                console.warn("No question stem found");
                return null;
            }

            // 1. Extract Image
            var image = null;
            var imgEl = questionStem.querySelector('img');
            if (imgEl) {
                image = imgEl.src;
            }

            // 2. Extract Main Question Text
            // Clone to safely manipulate without affecting the page
            var stemClone = questionStem.cloneNode(true);
            var stemImg = stemClone.querySelector('img');
            if (stemImg) stemImg.remove();

            // Replace <br> with newlines
            var htmlWithLineBreaks = stemClone.innerHTML;
            htmlWithLineBreaks = htmlWithLineBreaks.replace(/\<br\s*\/?\>/gi, '\n');
            stemClone.innerHTML = htmlWithLineBreaks;

            var questionText = stemClone.textContent.trim();
            questionText = questionText.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

            // 3. Process Dropdowns from .dropdown-selection
            var contentData = {
                image: image,
                questionText: decodeHtmlEntities(questionText),
                statements: []
            };

            var dropdownSelection = document.querySelector('.dropdown-selection');
            if (dropdownSelection) {
                var childNodes = Array.from(dropdownSelection.childNodes);
                var chunks = [];
                var currentNodes = [];

                // Split child nodes into sentences based on Line Breaks
                // A 'chunk' ends when we hit a <br> or a span containing <br> children
                childNodes.forEach(node => {
                    var isBr = false;

                    // Direct BR element
                    if (node.nodeName === 'BR') {
                        isBr = true;
                    }
                    // SPAN that contains BR children (separator between statements)
                    else if (node.nodeName === 'SPAN') {
                        // Check if this span has BR children
                        if (node.querySelector && node.querySelector('br')) {
                            isBr = true;
                        }
                    }

                    if (isBr) {
                        if (currentNodes.length > 0) {
                            chunks.push(currentNodes);
                            currentNodes = [];
                        }
                    } else {
                        currentNodes.push(node);
                    }
                });
                if (currentNodes.length > 0) chunks.push(currentNodes);

                // Iterate through chunks to build statements
                for (let i = 0; i < chunks.length; i++) {
                    let chunkNodes = chunks[i];
                    let statementText = "";
                    let dropdowns = []; // Array of dropdown option arrays

                    for (let node of chunkNodes) {
                        // Check if this node is a dropdown wrapper
                        if (node.classList && (node.classList.contains('dropdown') || node.querySelector('nb-select'))) {
                            // Add placeholder for dropdown
                            statementText += "{dropdown}";

                            // Extract Dropdown Options
                            let btn = node.querySelector('button');
                            if (btn) {
                                // Click to open
                                btn.click();
                                await delay(500); // Wait for animation/DOM

                                // Find all options in the DOM
                                let options = Array.from(document.querySelectorAll('nb-option'))
                                    .map(o => o.textContent.trim());

                                // Add this dropdown's options to our array
                                dropdowns.push({
                                    options: options
                                });

                                // Close the dropdown
                                btn.click();
                                await delay(300);
                            } else {
                                // No button found, add empty dropdown
                                dropdowns.push({
                                    options: []
                                });
                            }
                        } else {
                            // Regular text
                            statementText += node.textContent;
                        }
                    }

                    // Clean up the statement text and add to statements array
                    let cleanedText = statementText.trim().replace(/\s+/g, ' ');
                    if (cleanedText) {
                        contentData.statements.push({
                            text: cleanedText,
                            dropdowns: dropdowns
                        });
                    }
                }
            }

            // 4. Extract correct answers from .gi-answer elements
            // These appear after clicking the "Answer" button in review mode
            var correctAnswerSpans = document.querySelectorAll('.gi-answer');
            if (correctAnswerSpans.length > 0) {
                let answerIndex = 0;

                // Match correct answers to dropdowns
                for (let statement of contentData.statements) {
                    if (statement.dropdowns) {
                        for (let dropdown of statement.dropdowns) {
                            if (correctAnswerSpans[answerIndex]) {
                                dropdown.correctAnswer = correctAnswerSpans[answerIndex].textContent.trim();
                                answerIndex++;
                            }
                        }
                    }
                }
            }

            // 5. Metadata
            var metadata = extractGMATHeroMetadata();

            // Construct Final JSON
            var jsonData = {
                "questionLink": getPracticeUrl(),
                "source": "OG",
                "difficulty": metadata.difficulty || "",
                "section": "di",
                "questionType": "di",
                "category": "GI",
                "content": contentData
                // Note: 'correctAnswer' is not easily standardizable for multi-part DI questions 
                // without a specific schema (e.g. array of correct values).
                // Existing system might expect a string. We leave it out or put a placeholder.
            };

            return jsonData;

        } catch (error) {
            console.error("Error extracting DI Content:", error);
            return null;
        }
    }

    function clickNextButton() {
        var footer = document.querySelector('footer');
        if (footer) {
            var navElements = footer.querySelectorAll('.pointer.disable-select');
            for (var el of navElements) {
                if (el.textContent.toLowerCase().includes('next')) {
                    el.click();
                    return true;
                }
            }
        }
        return false;
    }

    function showCorrectAnswerToggle() {
        var reviewButtons = document.querySelectorAll('.pointer.hover-green.sub.only-review');
        for (var btn of reviewButtons) {
            if (btn.textContent.toLowerCase().includes('answer')) {
                btn.click();
                return true;
            }
        }
        return false;
    }

    async function processLoop() {
        extractedQuestions = [];
        var popupStatus = popup.document.getElementById('status');
        var popupCount = popup.document.getElementById('count');

        while (isRunning) {
            // 1. Ensure Answer is Shown (if available, mostly for getting correct metadata if we could)
            // But for DI options scraping, we might not need it, BUT if the user wants to see 'correct vs incorrect', 
            // usually you need to be in 'review' state. 
            // We'll attempt to click it.
            if (showCorrectAnswerToggle()) {
                await delay(1000); // Wait for answer to be revealed
            }

            // 2. Extract Data
            var data = await extractQuestionData();
            if (data) {
                extractedQuestions.push(data);
                if (popupCount) popupCount.textContent = extractedQuestions.length;
            }

            // 3. Check for completion (Last Question)
            var quizNoEl = document.querySelector('.quiz-no span');
            if (quizNoEl) {
                var text = quizNoEl.textContent.trim(); // "5 of 10"
                var parts = text.split(' of ');
                if (parts.length === 2) {
                    if (parseInt(parts[0]) === parseInt(parts[1])) {
                        stopExtraction();
                        return;
                    }
                }
            }

            // 4. Next Question
            var hasNext = clickNextButton();
            if (!hasNext) {
                stopExtraction();
                return;
            }

            // 5. Wait for Next Page Load
            await delay(3000); // 3 seconds for page transition
        }
    }

    function saveQuestionsToJSON() {
        if (extractedQuestions.length === 0) return;

        var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        var filename = 'gmat-di-' + timestamp + '.json';
        var jsonData = JSON.stringify({
            totalRecords: extractedQuestions.length,
            questions: extractedQuestions
        }, null, 2);

        var blob = new Blob([jsonData], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        console.log('Saved to ' + filename);
    }

    function startExtraction() {
        if (isRunning) return;
        isRunning = true;

        var startBtn = popup.document.getElementById('start-btn');
        var stopBtn = popup.document.getElementById('stop-btn');
        var status = popup.document.getElementById('status');

        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (status) {
            status.textContent = 'Running...';
            status.style.color = 'green';
        }

        processLoop();
    }

    function stopExtraction() {
        isRunning = false;

        var startBtn = popup.document.getElementById('start-btn');
        var stopBtn = popup.document.getElementById('stop-btn');
        var status = popup.document.getElementById('status');

        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (status) {
            status.textContent = 'Stopped';
            status.style.color = 'red';
        }

        saveQuestionsToJSON();
    }

    // Initialize Popup
    popup.document.write(`
        <html>
        <head>
            <title>GMAT DI Extractor</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                h2 { text-align: center; color: #333; }
                .controls { text-align: center; margin: 20px 0; }
                button { padding: 10px 20px; margin: 5px; cursor: pointer; color: white; border: none; border-radius: 4px; font-size: 16px; }
                #start-btn { background-color: #4CAF50; }
                #stop-btn { background-color: #f44336; }
                button:disabled { background-color: #ccc; cursor: not-allowed; }
                .status { text-align: center; margin-top: 20px; font-weight: bold; }
                .count { text-align: center; font-size: 24px; color: #2196F3; margin-top: 10px; }
            </style>
        </head>
        <body>
            <h2>GMAT DI Extractor</h2>
            <div class="controls">
                <button id="start-btn" onclick="window.opener.startExtraction()">Start</button>
                <button id="stop-btn" onclick="window.opener.stopExtraction()" disabled>Stop</button>
            </div>
            <div class="status">Status: <span id="status">Ready</span></div>
            <div class="count">Extracted: <span id="count">0</span></div>
        </body>
        </html>
    `);

    // Expose functions
    window.startExtraction = startExtraction;
    window.stopExtraction = stopExtraction;

})();
