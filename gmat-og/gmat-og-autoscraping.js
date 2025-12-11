javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT OG Extractor", "width=600,height=400,scrollbars=yes");

    // Global variables to store extracted questions and control the process
    var extractedQuestions = [];
    var isRunning = false;
    var intervalId = null;
    var startTime = null;

    // ============================================
    // HELPER FUNCTIONS (from gmatOG.js)
    // ============================================

    // Helper function to decode HTML entities
    function decodeHtmlEntities(text) {
        var textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
    }

    // Get the current page URL
    function getCurrentUrl() {
        return window.location.href;
    }

    // Convert time format from "52 secs" or "2 mins 52 secs" to "MM:SS" format
    function formatTimeToMMSS(timeString) {
        if (!timeString) return "";

        var minutes = 0;
        var seconds = 0;

        // Match patterns like "2 mins", "2 min", "1 minute", etc.
        var minsMatch = timeString.match(/(\d+)\s*min(s|ute|utes)?/i);
        if (minsMatch) {
            minutes = parseInt(minsMatch[1], 10);
        }

        // Match patterns like "52 secs", "52 sec", "5 seconds", etc.
        var secsMatch = timeString.match(/(\d+)\s*sec(s|ond|onds)?/i);
        if (secsMatch) {
            seconds = parseInt(secsMatch[1], 10);
        }

        // If no match found, return original string
        if (minutes === 0 && seconds === 0 && !minsMatch && !secsMatch) {
            return timeString;
        }

        // Format as MM:SS
        var formattedMins = String(minutes).padStart(2, '0');
        var formattedSecs = String(seconds).padStart(2, '0');

        return formattedMins + ":" + formattedSecs;
    }

    // Extract time spent from OG Practice page
    function extractTimeSpent() {
        var timeContainer = document.querySelector('.answer-time-taken');
        if (!timeContainer) {
            return "";
        }

        var timeSpan = timeContainer.querySelector('span');
        if (timeSpan) {
            var rawTime = timeSpan.textContent.trim();
            return formatTimeToMMSS(rawTime);
        }

        return "";
    }

    // Extract selected answer from OG Practice page
    function extractSelectedAnswer() {
        // Look for incorrect answer (user got it wrong)
        var incorrectChoice = document.querySelector('.multi-choice.incorrect');
        if (incorrectChoice) {
            return incorrectChoice.getAttribute('data-choice') || "";
        }

        // Check for correct answer (user got it right - has "correct" class)
        var correctChoice = document.querySelector('.multi-choice.correct');
        if (correctChoice) {
            return correctChoice.getAttribute('data-choice') || "";
        }

        // Fallback: check for "corrected" class
        var correctedChoice = document.querySelector('.multi-choice.corrected');
        if (correctedChoice) {
            return correctedChoice.getAttribute('data-choice') || "";
        }

        return "";
    }

    // Extract correct answer from OG Practice page
    function extractCorrectAnswer() {
        // Check for "corrected" class (shows the correct answer when user was wrong)
        var correctedChoice = document.querySelector('.multi-choice.corrected');
        if (correctedChoice) {
            return correctedChoice.getAttribute('data-choice') || "";
        }

        // Check for "correct" class (user selected the correct answer)
        var correctChoice = document.querySelector('.multi-choice.correct');
        if (correctChoice) {
            return correctChoice.getAttribute('data-choice') || "";
        }

        return "";
    }

    // Extract category from OG Practice page
    function extractCategory() {
        var answerSection = document.querySelector('#answer');
        if (!answerSection) {
            return "";
        }

        var categoryHeader = answerSection.querySelector('h4');
        if (categoryHeader) {
            return categoryHeader.textContent.trim();
        }

        return "";
    }

    // Detect question section (RC or CR) from OG Practice page
    function detectOGSection() {
        // Check if there's a reading passage (indicates RC)
        var passageContainer = document.querySelector('.reading-passage');
        if (passageContainer) {
            return "Reading Comprehension";
        }

        // Check for CR-specific elements or patterns
        var questionContent = document.querySelector('#content-question-start');
        if (questionContent) {
            // Check if there's a passage div that might indicate RC
            var passageCheck = document.querySelector('#content-passage-start');
            if (passageCheck) {
                return "Reading Comprehension";
            }
            return "Critical Reasoning";
        }

        return "Unknown";
    }

    // Process highlighted text - convert <mark><span>text</span></mark> to ==text==
    function processHighlights(html) {
        var processed = html.replace(/<mark[^>]*><span[^>]*class="reading-passage-reference"[^>]*>(.*?)<\/span><\/mark>/gi, '==$1==');
        processed = processed.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
        return processed;
    }

    // Process boldface text - convert <strong>text</strong> to **text**
    function processBoldface(html) {
        return html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    }

    // Extract highlight ranges from text with ==marker== format
    function extractHighlightRanges(textWithMarkers) {
        var highlightRanges = [];
        var cleanText = '';

        // Find all ==...== patterns
        var regex = /==(.*?)==/g;
        var match;
        var lastIndex = 0;

        while ((match = regex.exec(textWithMarkers)) !== null) {
            // Add text before the highlight
            var beforeHighlight = textWithMarkers.substring(lastIndex, match.index);
            cleanText += beforeHighlight;

            // Calculate start position in clean text
            var start = cleanText.length;

            // Add the highlighted content (without markers)
            var highlightedContent = match[1];
            cleanText += highlightedContent;

            // Calculate end position in clean text
            var end = cleanText.length;

            // Record the range
            highlightRanges.push({ start: start, end: end });

            // Update lastIndex to after the closing ==
            lastIndex = regex.lastIndex;
        }

        // Add any remaining text after the last highlight
        cleanText += textWithMarkers.substring(lastIndex);

        return { cleanText: cleanText, highlightRanges: highlightRanges };
    }

    // ============================================
    // EXTRACTION FUNCTIONS (from gmatOG.js)
    // ============================================

    // Extract RC (Reading Comprehension) question from OG Practice
    function extractOGRCContent() {
        try {
            // Extract passage
            var passageContainer = document.querySelector('.reading-passage');
            if (!passageContainer) {
                console.warn("Could not find OG passage container!");
                return null;
            }

            var passageHTML = passageContainer.innerHTML;

            // Process highlights (==text==)
            passageHTML = processHighlights(passageHTML);

            // Process boldface (**text**)
            passageHTML = processBoldface(passageHTML);

            // Remove reading-passage-reference spans but keep content
            passageHTML = passageHTML.replace(/<span[^>]*class="reading-passage-reference"[^>]*>(.*?)<\/span>/gi, '$1');

            // Convert paragraph tags to newlines
            passageHTML = passageHTML.replace(/<\/p>/gi, '\n\n');
            passageHTML = passageHTML.replace(/<p[^>]*>/gi, '');
            passageHTML = passageHTML.replace(/<br\s*\/?>/gi, '\n');

            // Remove remaining HTML tags
            var passageText = passageHTML.replace(/<[^>]*>/g, '');
            passageText = decodeHtmlEntities(passageText).trim();

            // Extract highlight ranges and clean the passage text
            var highlightResult = extractHighlightRanges(passageText);
            passageText = highlightResult.cleanText;
            var highlightRanges = highlightResult.highlightRanges;

            // Extract question
            var questionContainer = document.querySelector('#content-question-start');
            if (!questionContainer) {
                console.warn("Could not find OG question container!");
                return null;
            }

            var questionHTML = questionContainer.innerHTML;

            // Process highlights and boldface
            questionHTML = processHighlights(questionHTML);
            questionHTML = processBoldface(questionHTML);

            // Remove question ID (e.g., <p class="e_id">100454</p>)
            questionHTML = questionHTML.replace(/<p[^>]*class="e_id"[^>]*>.*?<\/p>/gi, '');

            // Remove answer choices from question HTML
            questionHTML = questionHTML.replace(/<ul[^>]*class="question-choices[^>]*>.*?<\/ul>/gis, '');

            // Extract just the question text
            var questionText = questionHTML
                .replace(/<p[^>]*>/gi, '')
                .replace(/<\/p>/gi, '')
                .replace(/<br\s*\/?>/gi, ' ')
                .replace(/<[^>]*>/g, '')
                .trim();
            questionText = decodeHtmlEntities(questionText);
            // Remove "Question" prefix if present
            questionText = questionText.replace(/^Question\s*\n*\s*/i, '').trim();

            // Extract answer choices
            var answerChoices = [];
            var choicesContainer = document.querySelector('.question-choices-multi');

            if (choicesContainer) {
                var choices = choicesContainer.querySelectorAll('li');
                choices.forEach(function (choice) {
                    var choiceContent = choice.querySelector('.choice-content');
                    if (choiceContent) {
                        var choiceHTML = choiceContent.innerHTML;
                        choiceHTML = processBoldface(choiceHTML);
                        choiceHTML = processHighlights(choiceHTML);
                        var choiceText = choiceHTML.replace(/<[^>]*>/g, '').trim();
                        answerChoices.push(decodeHtmlEntities(choiceText));
                    }
                });
            }

            // Extract metadata
            var timeSpent = extractTimeSpent();
            var selectedAnswer = extractSelectedAnswer();
            var correctAnswer = extractCorrectAnswer();
            var category = extractCategory();

            // Create JSON structure for RC question
            var jsonData = {
                "questionLink": getCurrentUrl(),
                "source": "GMAT Official",
                "difficulty": "",
                "section": "verbal",
                "questionType": "rc",
                "correctAnswer": correctAnswer,
                "category": category || "RC",
                "content": {
                    "passage": passageText,
                    "questionText": questionText,
                    "answerChoices": answerChoices,
                    "highlight_ranges": highlightRanges
                }
            };

            return jsonData;

        } catch (error) {
            console.error("Error extracting OG RC content:", error);
            return null;
        }
    }

    // Extract CR (Critical Reasoning) question from OG Practice
    function extractOGCRContent() {
        try {
            // For CR, the passage is embedded in the question content
            var questionContainer = document.querySelector('#content-question-start');
            if (!questionContainer) {
                console.warn("Could not find OG question container!");
                return null;
            }

            var fullHTML = questionContainer.innerHTML;

            // Process highlights and boldface
            fullHTML = processHighlights(fullHTML);
            fullHTML = processBoldface(fullHTML);

            // Remove question ID
            fullHTML = fullHTML.replace(/<p[^>]*class="e_id"[^>]*>.*?<\/p>/gi, '');

            // Remove answer choices
            fullHTML = fullHTML.replace(/<ul[^>]*class="question-choices[^>]*>.*?<\/ul>/gis, '');

            // Split into paragraphs
            var textContent = fullHTML
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<p[^>]*>/gi, '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .trim();

            textContent = decodeHtmlEntities(textContent);
            // Remove "Question" prefix if present
            textContent = textContent.replace(/^Question\s*\n*\s*/i, '').trim();

            // Split into parts to separate passage from question
            var parts = textContent.split('\n\n').filter(function (p) { return p.trim().length > 0; });

            var passage = "";
            var questionText = "";

            // Check for "Complete the Argument" type questions
            // These have the question prompt first (ends with ?) and the passage/argument after (contains __________)
            var isCompleteArgument = false;
            var blankIndex = -1;
            for (var i = 0; i < parts.length; i++) {
                if (parts[i].includes("__________") || parts[i].includes("_____")) {
                    blankIndex = i;
                    isCompleteArgument = true;
                    break;
                }
            }

            if (isCompleteArgument && blankIndex > 0) {
                // For "Complete the Argument" questions:
                // - Question is the first part (the prompt)
                // - Passage is the part with the blank (and any parts in between)
                questionText = parts[0].trim();
                passage = parts.slice(1).join('\n\n').trim();
            } else {
                // Standard CR question: Find the question (typically ends with ?)
                var questionIndex = -1;
                for (var i = parts.length - 1; i >= 0; i--) {
                    var part = parts[i].trim();
                    if (part.includes("?")) {
                        var lowerPart = part.toLowerCase();
                        if (lowerPart.includes("which") ||
                            lowerPart.includes("what") ||
                            lowerPart.includes("how") ||
                            lowerPart.includes("why") ||
                            lowerPart.includes("except") ||
                            lowerPart.includes("following") ||
                            lowerPart.includes("assumption") ||
                            lowerPart.includes("conclusion") ||
                            lowerPart.includes("strengthen") ||
                            lowerPart.includes("weaken") ||
                            lowerPart.includes("flaw") ||
                            lowerPart.includes("vulnerable")) {
                            questionIndex = i;
                            questionText = part;
                            break;
                        }
                    }
                }

                // Fallback: last part with ? is the question
                if (questionIndex === -1) {
                    for (var i = parts.length - 1; i >= 0; i--) {
                        if (parts[i].includes("?")) {
                            questionIndex = i;
                            questionText = parts[i].trim();
                            break;
                        }
                    }
                }

                // Passage is everything before the question
                if (questionIndex > 0) {
                    passage = parts.slice(0, questionIndex).join('\n\n').trim();
                } else if (questionIndex === 0) {
                    // No separate passage, might be embedded
                    passage = "";
                } else {
                    // Couldn't find question, use entire content
                    passage = textContent;
                }
            }

            // Extract answer choices
            var answerChoices = [];
            var choicesContainer = document.querySelector('.question-choices-multi');

            if (choicesContainer) {
                var choices = choicesContainer.querySelectorAll('li');
                choices.forEach(function (choice) {
                    var choiceContent = choice.querySelector('.choice-content');
                    if (choiceContent) {
                        var choiceHTML = choiceContent.innerHTML;
                        choiceHTML = processBoldface(choiceHTML);
                        choiceHTML = processHighlights(choiceHTML);
                        var choiceText = choiceHTML.replace(/<[^>]*>/g, '').trim();
                        answerChoices.push(decodeHtmlEntities(choiceText));
                    }
                });
            }

            // Extract metadata
            var timeSpent = extractTimeSpent();
            var selectedAnswer = extractSelectedAnswer();
            var correctAnswer = extractCorrectAnswer();
            var category = extractCategory();

            // Create JSON structure for CR question
            var jsonData = {
                "questionLink": getCurrentUrl(),
                "source": "GMAT Official",
                "difficulty": "",
                "section": "verbal",
                "questionType": "cr",
                "correctAnswer": correctAnswer,
                "category": category || "",
                "content": {
                    "passage": passage,
                    "questionText": questionText,
                    "answerChoices": answerChoices
                }
            };

            return jsonData;

        } catch (error) {
            console.error("Error extracting OG CR content:", error);
            return null;
        }
    }

    // Main extraction function - detect type and extract accordingly
    function extractQuestionData() {
        var section = detectOGSection();
        console.log("Detected GMAT Official section:", section);

        switch (section) {
            case "Reading Comprehension":
                return extractOGRCContent();
            case "Critical Reasoning":
                return extractOGCRContent();
            default:
                console.warn("Unsupported GMAT Official question type:", section);
                return null;
        }
    }

    // ============================================
    // AUTO-SCRAPING FUNCTIONS
    // ============================================

    // Function to click the next button (OG-specific HTML structure)
    // Using keyboard navigation to avoid Benchprep framework internal errors
    function clickNextButton() {
        var toolbar = document.querySelector('.answer-toolbar-wrapper');
        if (!toolbar) {
            console.warn("Could not find .answer-toolbar-wrapper");
            return false;
        }

        var nextButton = toolbar.querySelector('a.toolbar-btn[data-label="next"]');
        if (nextButton && !nextButton.classList.contains('is-disabled')) {
            // Use keyboard event (Right Arrow) to navigate, which is cleaner
            var keydownEvent = new KeyboardEvent('keydown', {
                key: 'ArrowRight',
                code: 'ArrowRight',
                keyCode: 39,
                which: 39,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(keydownEvent);

            console.log("Next navigation triggered (keyboard)");
            return true;
        }
        console.warn("Next button not found or disabled");
        return false;
    }

    // Function to get current question number and total from header
    function getQuestionProgress() {
        // Look for the header title inside .answer-toolbar-wrapper with format "X of Y"
        var toolbar = document.querySelector('.answer-toolbar-wrapper');
        if (!toolbar) return null;

        var headerTitle = toolbar.querySelector('header.text-header h2.title');
        if (headerTitle) {
            var text = headerTitle.textContent.trim();
            var parts = text.split(' of ');
            if (parts.length === 2) {
                return {
                    current: parseInt(parts[0], 10),
                    total: parseInt(parts[1], 10)
                };
            }
        }
        return null;
    }

    // Function to check if we're on the last question
    function isLastQuestion() {
        var toolbar = document.querySelector('.answer-toolbar-wrapper');
        if (!toolbar) {
            console.log("isLastQuestion: toolbar not found");
            return false;
        }

        // Check if Next button is disabled
        var nextButton = toolbar.querySelector('a.toolbar-btn[data-label="next"]');
        if (nextButton && nextButton.classList.contains('is-disabled')) {
            console.log("isLastQuestion: Next button is disabled - this is the last question");
            return true;
        }

        // Also check progress header
        var progress = getQuestionProgress();
        if (progress) {
            console.log("isLastQuestion: Progress = " + progress.current + " of " + progress.total);
            if (progress.current === progress.total) {
                console.log("isLastQuestion: Current equals total - this is the last question");
                return true;
            }
        }

        return false;
    }

    // Function to save questions to JSON file
    function saveQuestionsToJSON() {
        try {
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            var categoryPart = "";
            if (extractedQuestions.length > 0 && extractedQuestions[0].category) {
                categoryPart = extractedQuestions[0].category
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .split(/\s+/)
                    .join('-');

                if (categoryPart) {
                    categoryPart += '-';
                }
            }

            var filename = 'gmat-og-' + categoryPart + timestamp + '.json';

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

            // Get current URL to check for duplicates
            var currentUrl = window.location.href;

            // Check if we've already extracted this question (duplicate detection)
            var alreadyExtracted = extractedQuestions.some(function (q) {
                return q.questionLink === currentUrl;
            });

            if (alreadyExtracted) {
                console.log("Duplicate detected - already extracted this question. Stopping.");
                stopExtraction();
                return;
            }

            // Extract current question
            var questionData = extractQuestionData();
            if (questionData) {
                extractedQuestions.push(questionData);
                popup.document.getElementById('count').textContent = extractedQuestions.length;

                // Update status with progress
                var progress = getQuestionProgress();
                if (progress) {
                    popup.document.getElementById('status').textContent =
                        'Extracted ' + progress.current + ' of ' + progress.total;
                }
            }

            // Check if we reached the last question (Next button disabled)
            var toolbar = document.querySelector('.answer-toolbar-wrapper');
            var nextButton = toolbar ? toolbar.querySelector('a.toolbar-btn[data-label="next"]') : null;

            if (nextButton && nextButton.classList.contains('is-disabled')) {
                console.log("Next button is disabled - reached last question. Stopping.");
                stopExtraction();
                return;
            }

            // Wait a bit for framework to stabilize before clicking next
            setTimeout(function () {
                if (!isRunning) return;

                // Click next button
                try {
                    var hasNext = clickNextButton();

                    // If no next button or disabled, stop the process
                    if (!hasNext) {
                        console.log("clickNextButton returned false - stopping.");
                        stopExtraction();
                    }
                } catch (e) {
                    console.error("Error clicking next:", e);
                }
            }, 1500);
        }, 4000); // Wait 4 seconds between each extraction to allow page to fully load
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
        '<title>GMAT OG Extractor</title>' +
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
        '<h2>GMAT Official Practice Extractor</h2>' +
        '<div class="instructions">' +
        '<p><strong>Instructions:</strong></p>' +
        '<ol>' +
        '<li>Make sure you are on a GMAT Official Practice question page</li>' +
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
    window.saveQuestionsToJSON = saveQuestionsToJSON;
})();
