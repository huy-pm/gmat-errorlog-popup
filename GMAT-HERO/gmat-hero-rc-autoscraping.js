javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT RC Extractor", "width=600,height=400,scrollbars=yes");

    // Global variables to store extracted questions and control the process
    var extractedQuestions = [];
    var isRunning = false;
    var intervalId = null;
    var startTime = null;

    // Helper function to decode HTML entities
    function decodeHtmlEntities(text) {
        var textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
    }

    // Helper function to get practice URL
    function getPracticeUrl() {
        var currentUrl = window.location.href;
        return currentUrl.replace('/review/', '/practice/');
    }

    // Helper function to extract metadata
    function extractGMATHeroMetadata() {
        var metadata = {
            isReviewMode: false,
            category: null,
            topic: null,
            selectedAnswer: null,
            difficulty: null,
            timeSpent: null,
            correctAnswer: null
        };

        // 1. Check is this review-mode
        var reviewModeEl = document.querySelector('.review-mode');
        metadata.isReviewMode = !!reviewModeEl;

        // 2. Extract category from .hide-small.centered
        var categoryEl = document.querySelector('.hide-small.centered');
        var url = window.location.href.toLowerCase();
        if (url.includes('rc') || url.includes('rrc')) {
            if (categoryEl) {
                var fullText = categoryEl.textContent.trim();
                var parts = fullText.split('-');
                if (parts.length > 1) {
                    metadata.topic = parts[parts.length - 1].trim();
                } else {
                    metadata.topic = fullText;
                }
            }
            metadata.category = "rc";

        } else {
            metadata.category = "";
        }

        // 3. Extract selected answer
        // Priority 1: Check for selected-answer class (most reliable for current selection)
        var selectedLabel = document.querySelector('.selected-answer');
        if (selectedLabel) {
            var forAttr = selectedLabel.getAttribute('for');
            if (forAttr) {
                var parts = forAttr.split('-');
                metadata.selectedAnswer = parts[parts.length - 1];

                // Check if it is correct (parent standard-choices has 'has-answered-correctly')
                var standardChoices = selectedLabel.closest('.standard-choices');
                if (standardChoices && standardChoices.classList.contains('has-answered-correctly')) {
                    metadata.correctAnswer = metadata.selectedAnswer;
                }
            }
        }

        // Priority 2: Fallback to round-div (history) if selected-answer not found
        if (!metadata.selectedAnswer) {
            var roundDivs = document.querySelectorAll('.round-div');
            if (roundDivs.length > 0) {
                var lastRoundDiv = roundDivs[roundDivs.length - 1];
                metadata.selectedAnswer = lastRoundDiv.textContent.trim();

                // Check if selected answer is correct (has 'green' class)
                if (lastRoundDiv.classList.contains('green')) {
                    metadata.correctAnswer = metadata.selectedAnswer;
                }
            }
        }

        // 4. Extract difficulty from .level-badge and map to easy/medium/hard
        var levelBadgeEl = document.querySelector('.level-badge');
        if (levelBadgeEl) {
            var difficultyText = levelBadgeEl.textContent.trim();
            var difficultyNum = parseInt(difficultyText, 10);

            if (!isNaN(difficultyNum)) {
                if (difficultyNum < 600) {
                    metadata.difficulty = 'easy';
                } else if (difficultyNum < 700) {
                    metadata.difficulty = 'medium';
                } else {
                    metadata.difficulty = 'hard';
                }
            }
        }

        // 5. Extract time spent from .pi-clock
        var clockIcon = document.querySelector('.pi-clock');
        if (clockIcon && clockIcon.nextElementSibling) {
            metadata.timeSpent = clockIcon.nextElementSibling.textContent.trim();
        }

        // 6. Extract correct answer (only if we haven't found it yet)
        if (!metadata.correctAnswer) {
            var correctAnswerLabel = document.querySelector('.correct-answer');
            if (correctAnswerLabel) {
                var forAttr = correctAnswerLabel.getAttribute('for');
                if (forAttr) {
                    var parts = forAttr.split('-');
                    metadata.correctAnswer = parts[parts.length - 1];
                }
            }
        }

        return metadata;
    }

    // Helper function to convert highlighted text to markdown
    function convertHighlightedTextToMarkdown(htmlContent) {
        // Replace spans with yellow background to markdown highlight format ==text==
        var result = htmlContent.replace(
            /<span\s+style="[^"]*background-color:\s*yellow[^"]*">([^<]*)<\/span>/gi,
            '==$1=='
        );
        return result;
    }

    // Helper function to extract highlight ranges from text with ==marker== format
    function extractHighlightRanges(textWithMarkers) {
        var highlightRanges = [];
        var cleanText = '';
        var lastIndex = 0;

        var regex = /==(.*?)==/g;
        var match;

        while ((match = regex.exec(textWithMarkers)) !== null) {
            var beforeHighlight = textWithMarkers.substring(lastIndex, match.index);
            cleanText += beforeHighlight;

            var start = cleanText.length;
            var highlightedContent = match[1];
            cleanText += highlightedContent;
            var end = cleanText.length;

            highlightRanges.push({ start: start, end: end });
            lastIndex = regex.lastIndex;
        }

        cleanText += textWithMarkers.substring(lastIndex);

        return { cleanText: cleanText, highlightRanges: highlightRanges };
    }

    // Function to extract data from current question (RC-specific)
    function extractQuestionData() {
        try {
            // Extract passage from left panel
            var leftPanel = document.getElementById('left-panel');
            if (!leftPanel) {
                console.error("Could not find the left-panel element!");
                return null;
            }

            var passageElement = leftPanel.querySelector('.passage');
            if (!passageElement) {
                console.error("Could not find the passage element!");
                return null;
            }

            // Get passage HTML and process it
            var passageHTML = passageElement.innerHTML;

            // Convert highlighted text to markdown format first (before removing HTML tags)
            passageHTML = convertHighlightedTextToMarkdown(passageHTML);

            // Split by <br> tags (handle both single and double <br>)
            // Replace double <br> with paragraph marker, then clean up
            var passageText = passageHTML
                .replace(/<br[^>]*>\s*<br[^>]*>/gi, '\n\n') // Double breaks = paragraph breaks
                .replace(/<br[^>]*>/gi, ' ') // Single breaks = spaces
                .replace(/<[^>]*>/g, '') // Remove all HTML tags
                .replace(/&ldquo;/g, '"')
                .replace(/&rdquo;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&[a-zA-Z0-9#]+;/g, '')
                .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs, but preserve newlines
                .trim();

            // Split into paragraphs and clean each one
            var paragraphs = passageText.split('\n\n')
                .map(function (p) { return p.trim(); })
                .filter(function (p) { return p.length > 0; });

            // Join paragraphs with double newlines
            var passage = paragraphs.join('\n');
            passage = decodeHtmlEntities(passage);

            // Extract highlight ranges and clean the passage text
            var highlightResult = extractHighlightRanges(passage);
            passage = highlightResult.cleanText;
            var highlightRanges = highlightResult.highlightRanges;

            // Extract question from right panel
            var rightPanel = document.getElementById('right-panel');
            if (!rightPanel) {
                console.error("Could not find the right-panel element!");
                return null;
            }

            var questionStem = rightPanel.querySelector('.question-stem');
            if (!questionStem) {
                console.error("Could not find the question-stem element!");
                return null;
            }

            // Get question HTML and convert highlighted text to markdown
            var questionHTML = questionStem.innerHTML;
            questionHTML = convertHighlightedTextToMarkdown(questionHTML);

            // Remove HTML tags and clean up
            var question = questionHTML
                .replace(/<[^>]*>/g, '') // Remove all HTML tags
                .replace(/&ldquo;/g, '"')
                .replace(/&rdquo;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&[a-zA-Z0-9#]+;/g, '')
                .trim();
            question = decodeHtmlEntities(question);

            // Extract answer choices
            var answerChoices = [];
            var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');

            if (standardChoices) {
                var options = standardChoices.querySelectorAll('.option.ng-star-inserted, .option');
                options.forEach(function (option) {
                    var label = option.querySelector('label');
                    if (label) {
                        var span = label.querySelector('span');
                        if (span) {
                            var answerText = span.textContent.trim();
                            if (answerText) {
                                answerChoices.push(decodeHtmlEntities(answerText));
                            }
                        }
                    }
                });
            }

            // Extract metadata
            var metadata = extractGMATHeroMetadata();

            // Create JSON structure for RC question
            var jsonData = {
                "questionLink": getPracticeUrl(),
                "source": "OG",
                "difficulty": metadata.difficulty || "",
                "section": "verbal",
                "questionType": "rc",
                "correctAnswer": metadata.correctAnswer || "",
                "category": metadata.category || "",
                "topic": metadata.topic || "",
                "content": {
                    "passage": passage,
                    "questionText": question,
                    "answerChoices": answerChoices,
                    "highlight_ranges": highlightRanges
                }
            };

            return jsonData;
        } catch (error) {
            console.error("Error occurred while extracting question data: " + (error.message || error));
            return null;
        }
    }

    // Function to click the next button
    function clickNextButton() {
        var nextButton = null;
        var footer = document.querySelector('footer');
        if (footer) {
            var navElements = footer.querySelectorAll('.pointer.disable-select');
            navElements.forEach(function (element) {
                var text = element.textContent.toLowerCase();
                if (text.includes('next')) {
                    nextButton = element;
                }
            });
        }

        if (nextButton) {
            nextButton.click();
            return true;
        }
        return false;
    }

    // Function to show correct answer by clicking the "Answer" button
    function showCorrectAnswer() {
        var answerButton = null;
        var reviewButtons = document.querySelectorAll('.pointer.hover-green.sub.only-review');

        reviewButtons.forEach(function (button) {
            var text = button.textContent.toLowerCase();
            if (text.includes('answer')) {
                answerButton = button;
            }
        });

        if (answerButton) {
            answerButton.click();
            return true;
        }
        return false;
    }

    // Function to save questions to JSON file
    function saveQuestionsToJSON() {
        try {
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            var categoryPart = "";
            if (extractedQuestions.length > 0 && extractedQuestions[0].topic) {
                categoryPart = extractedQuestions[0].topic
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .split(/\s+/)
                    .join('-');

                if (categoryPart) {
                    categoryPart += '-';
                }
            }

            var filename = 'gmat-rc-' + categoryPart + timestamp + '.json';

            // Wrap questions in object with totalRecords
            var output = {
                totalRecords: extractedQuestions.length,
                questions: extractedQuestions
            };

            var jsonData = JSON.stringify(output, null, 2);

            var blob = new Blob([jsonData], { type: 'application/json' });
            var url = URL.createObjectURL(blob);

            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            console.log('Questions saved to ' + filename);
        } catch (error) {
            console.error("Error saving questions to JSON: " + (error.message || error));
        }
    }


    function startExtraction() {
        if (isRunning) return;

        isRunning = true;
        startTime = new Date();
        extractedQuestions = [];

        // Update UI
        popup.document.getElementById('start-btn').disabled = true;
        popup.document.getElementById('stop-btn').disabled = false;
        popup.document.getElementById('status').textContent = 'Running...';
        popup.document.getElementById('status').style.color = 'green';

        // Start the extraction loop
        intervalId = setInterval(function () {
            if (!isRunning) return;

            // Extract current question
            var questionData = extractQuestionData();
            if (questionData) {
                extractedQuestions.push(questionData);
                popup.document.getElementById('count').textContent = extractedQuestions.length;
            }

            // Check if we reached the last question
            var quizNoEl = document.querySelector('.quiz-no span');
            if (quizNoEl) {
                var text = quizNoEl.textContent.trim();
                var parts = text.split(' of ');
                if (parts.length === 2) {
                    var currentQ = parseInt(parts[0]);
                    var totalQ = parseInt(parts[1]);

                    if (currentQ === totalQ && extractedQuestions.length === totalQ) {
                        stopExtraction();
                        return;
                    }
                }
            }

            // Click next button

            // Click next button
            var hasNext = clickNextButton();

            // If there's a next question, show the correct answer for it
            if (hasNext) {
                // Wait a bit for the page to load, then show the answer
                setTimeout(function () {
                    showCorrectAnswer();
                }, 500);
            }

            // If no next button, stop the process
            if (!hasNext) {
                stopExtraction();
                saveQuestionsToJSON();
            }
        }, 2000); // Wait 2 seconds between each extraction to allow page to load
    }

    // Function to stop the extraction process
    function stopExtraction() {
        isRunning = false;

        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }

        // Update UI
        if (popup && !popup.closed) {
            popup.document.getElementById('start-btn').disabled = false;
            popup.document.getElementById('stop-btn').disabled = true;
            popup.document.getElementById('status').textContent = 'Stopped';
            popup.document.getElementById('status').style.color = 'red';
        }

        // Save questions to JSON
        if (extractedQuestions.length > 0) {
            saveQuestionsToJSON();
        }
    }

    // Write the popup content
    popup.document.write(
        '<html>' +
        '<head>' +
        '<title>GMAT RC Extractor</title>' +
        '<style>' +
        'body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }' +
        'h2 { color: #333; text-align: center; }' +
        '.controls { text-align: center; margin: 20px 0; }' +
        'button { padding: 10px 20px; margin: 5px; background-color: #2196F3; color: white; border: none; cursor: pointer; border-radius: 4px; font-size: 16px; }' +
        'button:hover { background-color: #0b7dda; }' +
        'button:disabled { background-color: #cccccc; cursor: not-allowed; }' +
        '#start-btn { background-color: #4CAF50; }' +
        '#start-btn:hover { background-color: #45a049; }' +
        '#stop-btn { background-color: #f44336; }' +
        '#stop-btn:hover { background-color: #d32f2f; }' +
        '.status { text-align: center; margin: 20px 0; font-size: 18px; }' +
        '.count { text-align: center; font-size: 24px; font-weight: bold; color: #2196F3; }' +
        '.instructions { background: #f4f4f4; padding: 15px; border-left: 4px solid #333; margin: 20px 0; }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<h2>GMAT RC Question Extractor</h2>' +
        '<div class="instructions">' +
        '<p><strong>Instructions:</strong></p>' +
        '<ol>' +
        '<li>Click "Start" to begin extracting questions</li>' +
        '<li>The script will automatically navigate through questions</li>' +
        '<li>Click "Stop" to stop the process and save all questions</li>' +
        '</ol>' +
        '</div>' +
        '<div class="controls">' +
        '<button id="start-btn" onclick="window.opener.startExtraction()">Start</button>' +
        '<button id="stop-btn" onclick="window.opener.stopExtraction()" disabled>Stop</button>' +
        '</div>' +
        '<div class="status">Status: <span id="status">Ready</span></div>' +
        '<div class="count">Questions Extracted: <span id="count">0</span></div>' +
        '</body>' +
        '</html>'
    );

    // Attach functions to the window object so they can be accessed by the popup
    window.startExtraction = startExtraction;
    window.stopExtraction = stopExtraction;
    window.extractQuestionData = extractQuestionData;
    window.clickNextButton = clickNextButton;
    window.showCorrectAnswer = showCorrectAnswer;
    window.saveQuestionsToJSON = saveQuestionsToJSON;
})();
