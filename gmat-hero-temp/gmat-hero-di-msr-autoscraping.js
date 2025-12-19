javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT MSR Extractor", "width=600,height=400,scrollbars=yes");

    // Global variables
    var extractedQuestionSet = null;
    var currentQuestionIndex = 0;
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
     * Extract metadata (Category, Difficulty, etc.)
     */
    function extractGMATHeroMetadata() {
        var metadata = {
            isReviewMode: false,
            category: "MSR",
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
     * Extract data sources from tabs
     */
    async function extractDataSources() {
        var irMsr = document.querySelector('.ir-msr');
        if (!irMsr) {
            console.warn("No .ir-msr container found");
            return null;
        }

        var tabs = [];

        // Get all tab headers
        var tabHeaders = irMsr.querySelectorAll('.p-tabview-nav li a span');
        var tabPanels = irMsr.querySelectorAll('.p-tabview-panel');

        if (tabHeaders.length !== tabPanels.length) {
            console.warn("Mismatch between tab headers and panels");
            return null;
        }

        // Extract content from each tab
        for (var i = 0; i < tabHeaders.length; i++) {
            var tabName = tabHeaders[i].textContent.trim();

            // Click tab to activate it
            var tabLink = tabHeaders[i].closest('a');
            if (tabLink) {
                tabLink.click();
                await delay(500); // Wait for tab content to load
            }

            var panel = tabPanels[i];
            var content = {
                text: "",
                table: null,
                images: []
            };

            // Extract text content
            var textDiv = panel.querySelector('div[_ngcontent-ng-c2296498254]');
            if (textDiv) {
                // Clone the div to manipulate
                var clonedDiv = textDiv.cloneNode(true);

                // Remove table and img elements to get clean text
                var tablesToRemove = clonedDiv.querySelectorAll('table');
                tablesToRemove.forEach(function (t) { t.remove(); });
                var imgsToRemove = clonedDiv.querySelectorAll('img');
                imgsToRemove.forEach(function (img) { img.remove(); });

                content.text = decodeHtmlEntities(clonedDiv.textContent.trim());

                // Extract table if present
                var table = textDiv.querySelector('table.embed-table');
                if (table) {
                    var headers = [];
                    var rows = [];

                    // Extract headers
                    var headerCells = table.querySelectorAll('thead th');
                    headerCells.forEach(function (th) {
                        headers.push(th.textContent.trim());
                    });

                    // Extract rows
                    var tableRows = table.querySelectorAll('tbody tr');
                    tableRows.forEach(function (tr) {
                        var rowData = [];
                        var cells = tr.querySelectorAll('td');
                        cells.forEach(function (td) {
                            rowData.push(td.textContent.trim());
                        });
                        if (rowData.length > 0) {
                            rows.push(rowData);
                        }
                    });

                    if (headers.length > 0 || rows.length > 0) {
                        content.table = {
                            headers: headers,
                            rows: rows
                        };
                    }
                }

                // Extract images
                var images = textDiv.querySelectorAll('img');
                images.forEach(function (img) {
                    var src = img.getAttribute('src');
                    if (src) {
                        content.images.push(src);
                    }
                });
            }

            tabs.push({
                name: tabName,
                content: content
            });
        }

        return { tabs: tabs };
    }

    /**
     * Extract current question
     */
    function extractQuestion() {
        // Extract question text
        var questionStem = document.querySelector('#right-panel .question-stem');
        if (!questionStem) {
            console.warn("No question stem found");
            return null;
        }
        var questionText = decodeHtmlEntities(questionStem.textContent.trim());

        // Detect question type
        var yesNoQuestion = document.querySelector('.yes-no-question');
        var standardChoices = document.querySelector('.standard-choices');

        var question = {
            questionText: questionText
        };

        if (yesNoQuestion) {
            // Binary choice question
            question.questionType = "binary";

            var gridItems = Array.from(yesNoQuestion.querySelectorAll('.grid-item'));

            // Extract choice labels
            var choice1Label = gridItems[0] ? gridItems[0].querySelector('b').textContent.trim() : 'Yes';
            var choice2Label = gridItems[1] ? gridItems[1].querySelector('b').textContent.trim() : 'No';

            question.choiceLabels = [choice1Label, choice2Label];
            question.statements = [];

            // Extract statements (skip first 3 grid items: headers)
            for (var i = 3; i < gridItems.length; i += 3) {
                var radioChoice1Div = gridItems[i];
                var radioChoice2Div = gridItems[i + 1];
                var statementTextDiv = gridItems[i + 2];

                if (!statementTextDiv) break;

                var statementText = statementTextDiv.textContent.trim();

                // Find correct answer
                var correctAnswer = null;
                var radioChoice1 = radioChoice1Div.querySelector('p-radiobutton');
                var radioChoice2 = radioChoice2Div.querySelector('p-radiobutton');

                if (radioChoice1 && radioChoice1.classList.contains('correct-answer')) {
                    correctAnswer = choice1Label;
                } else if (radioChoice2 && radioChoice2.classList.contains('correct-answer')) {
                    correctAnswer = choice2Label;
                }

                question.statements.push({
                    text: statementText,
                    correctAnswer: correctAnswer
                });
            }
        } else if (standardChoices) {
            // Multiple choice question
            question.questionType = "multipleChoice";
            question.options = [];
            question.correctAnswer = null;

            var options = standardChoices.querySelectorAll('.option');
            options.forEach(function (option) {
                var radioButton = option.querySelector('p-radiobutton input');
                var label = option.querySelector('label span');

                if (radioButton && label) {
                    var letter = radioButton.value;
                    var text = decodeHtmlEntities(label.textContent.trim());
                    var isCorrect = option.querySelector('p-radiobutton').classList.contains('correct-answer');

                    question.options.push({
                        letter: letter,
                        text: text,
                        isCorrect: isCorrect
                    });

                    if (isCorrect) {
                        question.correctAnswer = letter;
                    }
                }
            });
        }

        return question;
    }

    /**
     * Main Extraction Function (Async)
     */
    async function extractQuestionData() {
        try {
            // Extract metadata
            var metadata = extractGMATHeroMetadata();

            // If this is the first question, extract data sources
            if (!extractedQuestionSet) {
                var dataSources = await extractDataSources();
                if (!dataSources) {
                    console.error("Failed to extract data sources");
                    return null;
                }

                extractedQuestionSet = {
                    "questionSetLink": getPracticeUrl(),
                    "source": "OG",
                    "difficulty": metadata.difficulty || "",
                    "section": "di",
                    "questionType": "di",
                    "category": "MSR",
                    "dataSources": dataSources,
                    "questions": []
                };
            }

            // Extract current question
            var question = extractQuestion();
            if (!question) {
                console.error("Failed to extract question");
                return null;
            }

            // Add question ID
            question.questionId = extractedQuestionSet.questions.length + 1;

            // Add question to set
            extractedQuestionSet.questions.push(question);

            return extractedQuestionSet;

        } catch (error) {
            console.error("Error extracting MSR question:", error);
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
        extractedQuestionSet = null;
        currentQuestionIndex = 0;

        var popupStatus = popup.document.getElementById('status');
        var popupCount = popup.document.getElementById('count');

        while (isRunning) {
            // 1. Ensure Answer is Shown
            if (showCorrectAnswerToggle()) {
                await delay(1000);
            }

            // 2. Extract Data
            var data = await extractQuestionData();
            if (data) {
                currentQuestionIndex++;
                if (popupCount) popupCount.textContent = currentQuestionIndex;
            }

            // 3. Check for completion
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
            await delay(3000);
        }
    }

    function saveQuestionsToJSON() {
        if (!extractedQuestionSet || extractedQuestionSet.questions.length === 0) return;

        var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        var filename = 'gmat-di-msr-' + timestamp + '.json';
        var jsonData = JSON.stringify(extractedQuestionSet, null, 2);

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
            <title>GMAT MSR Extractor</title>
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
            <h2>GMAT MSR Extractor</h2>
            <div class="controls">
                <button id="start-btn" onclick="window.opener.startExtraction()">Start</button>
                <button id="stop-btn" onclick="window.opener.stopExtraction()" disabled>Stop</button>
            </div>
            <div class="status">Status: <span id="status">Ready</span></div>
            <div class="count">Questions Extracted: <span id="count">0</span></div>
        </body>
        </html>
    `);

    // Expose functions
    window.startExtraction = startExtraction;
    window.stopExtraction = stopExtraction;

})();
