javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT TPA Extractor", "width=600,height=400,scrollbars=yes");

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
            category: "TPA",
            difficulty: null,
            timeSpent: null
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

            // 1. Extract Question Text
            var htmlWithLineBreaks = questionStem.innerHTML;
            htmlWithLineBreaks = htmlWithLineBreaks.replace(/\<br\s*\/?\>/gi, '\n');
            var tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlWithLineBreaks;
            var questionText = tempDiv.textContent.trim();
            questionText = questionText.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

            // 2. Extract Column Headers
            var tpaQuestion = document.querySelector('.tpa-question');
            if (!tpaQuestion) {
                console.warn("No TPA question container found");
                return null;
            }

            var columnHeaders = [];
            var headerElements = tpaQuestion.querySelectorAll('.grid-item.center > b');
            headerElements.forEach(function (header) {
                columnHeaders.push(header.textContent.trim());
            });

            // 3. Extract Rows
            // The structure is: header, header, empty, radio, radio, text, radio, radio, text, ...
            var allGridItems = Array.from(tpaQuestion.querySelectorAll('.grid-item'));
            var rows = [];

            // Skip first 2 headers and 1 empty div (indices 0, 1, 2)
            // Then iterate through groups of 3: radio-part1, radio-part2, text
            for (var i = 3; i < allGridItems.length; i += 3) {
                var radioPart1 = allGridItems[i];
                var radioPart2 = allGridItems[i + 1];
                var textElement = allGridItems[i + 2];

                if (!textElement) break;

                // Get the option value from the radio input
                var radioInput = radioPart1.querySelector('input[type="radio"]');
                var optionValue = radioInput ? radioInput.value : "";

                var rowText = textElement.textContent.trim();

                rows.push({
                    text: rowText,
                    optionValue: optionValue
                });
            }

            // 4. Extract Correct Answers
            var correctAnswers = {
                column1: null,
                column2: null
            };

            // Find correct answer for column 1 (part-1)
            var correctPart1 = tpaQuestion.querySelector('p-radiobutton.correct-answer[name="part-1"] input');
            if (correctPart1) {
                correctAnswers.column1 = correctPart1.value;
            }

            // Find correct answer for column 2 (part-2)
            var correctPart2 = tpaQuestion.querySelector('p-radiobutton.correct-answer[name="part-2"] input');
            if (correctPart2) {
                correctAnswers.column2 = correctPart2.value;
            }

            // 5. Metadata
            var metadata = extractGMATHeroMetadata();

            // Construct Final JSON
            var jsonData = {
                "questionLink": getPracticeUrl(),
                "source": "gmat-hero",
                "difficulty": metadata.difficulty || "",
                "section": "di",
                "questionType": "di",
                "category": "TPA",
                "content": {
                    "questionText": decodeHtmlEntities(questionText),
                    "columnHeaders": columnHeaders,
                    "rows": rows,
                    "correctAnswers": correctAnswers
                }
            };

            return jsonData;

        } catch (error) {
            console.error("Error extracting TPA Content:", error);
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
            // 1. Ensure Answer is Shown
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
                var text = quizNoEl.textContent.trim();
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
        var filename = 'gmat-di-tpa-' + timestamp + '.json';
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
            <title>GMAT TPA Extractor</title>
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
            <h2>GMAT TPA Extractor</h2>
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
