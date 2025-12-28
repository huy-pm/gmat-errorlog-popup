javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT TA Extractor", "width=600,height=400,scrollbars=yes");

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
            category: "TA",
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
            // 1. Extract Intro Text
            var irTa = document.querySelector('.ir-ta');
            if (!irTa) {
                console.warn("No .ir-ta container found");
                return null;
            }

            var introTextDiv = irTa.querySelector('div.ng-star-inserted');
            var introText = introTextDiv ? introTextDiv.textContent.trim() : "";

            // 2. Extract Table Headers
            var thead = irTa.querySelector('thead');
            if (!thead) {
                console.warn("No thead found");
                return null;
            }

            var headerGroups = null;
            var headers = [];

            // Check if there's a sub-header row (merged headers)
            var subHeaderRow = thead.querySelector('tr.sub-header');
            if (subHeaderRow) {
                headerGroups = [];
                var groupHeaders = subHeaderRow.querySelectorAll('th');
                groupHeaders.forEach(function (th) {
                    var colspan = th.getAttribute('colspan') || '1';
                    headerGroups.push({
                        label: th.textContent.trim(),
                        colspan: parseInt(colspan, 10)
                    });
                });
            }

            // Extract regular headers (column names)
            var headerRows = thead.querySelectorAll('tr');
            var lastHeaderRow = headerRows[headerRows.length - 1];
            var headerCells = lastHeaderRow.querySelectorAll('th > div');
            headerCells.forEach(function (cell) {
                headers.push(cell.textContent.trim());
            });

            // 3. Extract Table Rows
            var tbody = irTa.querySelector('tbody');
            if (!tbody) {
                console.warn("No tbody found");
                return null;
            }

            var rows = [];
            var tableRows = tbody.querySelectorAll('tr');
            tableRows.forEach(function (tr) {
                var rowData = [];
                var cells = tr.querySelectorAll('td > span');
                cells.forEach(function (span) {
                    rowData.push(span.textContent.trim());
                });
                if (rowData.length > 0) {
                    rows.push(rowData);
                }
            });

            // 3.5. Extract Table Legend/Footnotes (if present)
            var tableLegend = null;
            var legendDiv = irTa.querySelector('.sortable-table + div.ng-star-inserted');
            if (legendDiv) {
                var legendText = legendDiv.textContent.trim();
                if (legendText) {
                    tableLegend = decodeHtmlEntities(legendText);
                }
            }

            // 4. Extract Question Instruction
            var questionStem = document.querySelector('#right-panel .question-stem');
            if (!questionStem) {
                console.warn("No question stem found");
                return null;
            }
            var questionInstruction = questionStem.textContent.trim();

            // 5. Extract Binary Choice Statements (Yes/No, True/False, etc.)
            var yesNoQuestion = document.querySelector('.yes-no-question');
            if (!yesNoQuestion) {
                console.warn("No yes-no-question container found");
                return null;
            }

            var gridItems = Array.from(yesNoQuestion.querySelectorAll('.grid-item'));

            // Extract the actual choice labels from headers (index 0 and 1)
            var choice1Label = gridItems[0] ? gridItems[0].querySelector('b').textContent.trim() : 'Y';
            var choice2Label = gridItems[1] ? gridItems[1].querySelector('b').textContent.trim() : 'N';

            var statements = [];

            // Pattern: Choice1 header (0), Choice2 header (1), empty (2), 
            // then repeating: radio-choice1 (3), radio-choice2 (4), statement-text (5)
            // Skip first 3 items, then process in groups of 3
            for (var i = 3; i < gridItems.length; i += 3) {
                var radioChoice1Div = gridItems[i];
                var radioChoice2Div = gridItems[i + 1];
                var statementTextDiv = gridItems[i + 2];

                if (!statementTextDiv) break;

                var statementText = statementTextDiv.textContent.trim();

                // Find correct answer by checking which radio button has 'correct-answer' class
                var correctAnswer = null;
                var radioChoice1 = radioChoice1Div.querySelector('p-radiobutton');
                var radioChoice2 = radioChoice2Div.querySelector('p-radiobutton');

                if (radioChoice1 && radioChoice1.classList.contains('correct-answer')) {
                    correctAnswer = choice1Label;
                } else if (radioChoice2 && radioChoice2.classList.contains('correct-answer')) {
                    correctAnswer = choice2Label;
                }

                statements.push({
                    text: statementText,
                    correctAnswer: correctAnswer
                });
            }

            // 6. Metadata
            var metadata = extractGMATHeroMetadata();

            // Construct table data
            var tableData = {
                "headers": headers,
                "rows": rows
            };

            // Add headerGroups if they exist (merged headers)
            if (headerGroups) {
                tableData.headerGroups = headerGroups;
            }

            // Add tableLegend if it exists (footnotes/definitions)
            if (tableLegend) {
                tableData.legend = tableLegend;
            }

            // Construct Final JSON
            var jsonData = {
                "questionLink": getPracticeUrl(),
                "source": "gmat-hero",
                "difficulty": metadata.difficulty || "",
                "section": "di",
                "questionType": "di",
                "category": "TA",
                "content": {
                    "introText": decodeHtmlEntities(introText),
                    "table": tableData,
                    "questionInstruction": decodeHtmlEntities(questionInstruction),
                    "statements": statements
                }
            };

            return jsonData;

        } catch (error) {
            console.error("Error extracting TA Content:", error);
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
        var filename = 'gmat-di-ta-' + timestamp + '.json';
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
            <title>GMAT TA Extractor</title>
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
            <h2>GMAT Table Analysis Extractor</h2>
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
