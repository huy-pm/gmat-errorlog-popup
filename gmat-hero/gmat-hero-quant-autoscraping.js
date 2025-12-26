javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT Quant Extractor", "width=600,height=400,scrollbars=yes");

    // Global variables to store extracted questions and control the process
    var extractedQuestions = [];
    var isRunning = false;
    var intervalId = null;
    var startTime = null;

    /**
     * Decode HTML entities
     */
    function decodeHtmlEntities(text) {
        var textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
    }

    /**
     * Escape currency symbols in plain text (e.g., $650, $21,300)
     * This should be called BEFORE KaTeX processing, when currency is plain text
     * and math expressions are still inside KaTeX elements.
     * 
     * Uses callback to check character after match to avoid regex backtracking issues
     */
    function escapeCurrencyInTextNode(textNode) {
        var text = textNode.textContent;
        if (!text.includes('$')) return;

        // Match $NUMBER and use callback to check what follows
        var newText = text.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, function (match, number, offset, str) {
            // Check character immediately after the match
            var charAfter = str.charAt(offset + match.length);

            // If followed by a letter, it's a LaTeX variable like $0.125k - don't escape
            if (/[a-zA-Z]/.test(charAfter)) {
                return match;
            }

            // Otherwise, it's currency - escape it
            return '\\$' + number;
        });

        if (newText !== text) {
            textNode.textContent = newText;
        }
    }

    /**
     * Normalize currency format in extracted text
     * Converts KaTeX-wrapped currency like $\$247.00$ to just \$247.00
     * This ensures consistent output regardless of how GMAT Hero renders currency
     */
    function normalizeCurrency(text) {
        // Pattern: $\$NUMBER$ - KaTeX wrapped escaped currency
        // Convert to just \$NUMBER
        return text.replace(/\$\\?\\\$(\d[\d,]*(?:\.\d+)?)\$/g, '\\$$$1');
    }

    /**
     * Walk through text nodes in an element and escape currency
     * Skips nodes that are inside KaTeX elements
     */
    function escapeCurrencyInElement(element) {
        var walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    // Skip if inside a KaTeX element
                    var parent = node.parentNode;
                    while (parent && parent !== element) {
                        if (parent.classList && parent.classList.contains('katex')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        parent = parent.parentNode;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        var textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(escapeCurrencyInTextNode);
    }

    /**
     * Get practice URL from current URL (replace /review/ with /practice/)
     */
    function getPracticeUrl() {
        var currentUrl = window.location.href;
        return currentUrl.replace('/review/', '/practice/');
    }

    /**
     * Extract metadata from GMAT Hero page (category, difficulty, selected/correct answers, time spent)
     */
    function extractGMATHeroMetadata() {
        var metadata = {
            isReviewMode: false,
            category: null,
            selectedAnswer: null,
            difficulty: null,
            timeSpent: null,
            correctAnswer: null
        };

        // 1. Check is this review-mode
        var reviewModeEl = document.querySelector('.review-mode');
        metadata.isReviewMode = !!reviewModeEl;

        // 2. Extract category from .hide-small.centered
        const categoryEl = document.querySelector('.hide-small.centered');
        const url = window.location.href.toLowerCase();
        if (url.includes('quant') || url.includes('qt' || url.includes('rq'))
            || url.includes('cr') || url.includes('rcr')) {
            if (categoryEl) {
                const fullText = categoryEl.textContent.trim();
                const parts = fullText.split('-');
                if (parts.length > 1) {
                    metadata.category = parts[parts.length - 1].trim();
                } else {
                    metadata.category = fullText;
                }
            }
        } else if (url.includes('rc') || url.includes('rrc')) {
            metadata.category = "rc"
        }
        else {
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

    // Function to extract data from current question
    function extractQuestionData() {
        try {
            var rightPanel = document.getElementById('right-panel');
            if (!rightPanel) {
                console.warn("Could not find GMAT Hero right-panel element!");
                return null;
            }

            var questionStem = rightPanel.querySelector('.question-stem');
            if (!questionStem) {
                console.warn("Could not find GMAT Hero question-stem element!");
                return null;
            }

            // Extract image if exists
            var questionImage = null;
            var imgElement = questionStem.querySelector('img');
            if (imgElement) {
                // Use .src property to get absolute URL instead of .getAttribute('src')
                questionImage = imgElement.src;
            }

            var questionHTML = questionStem.innerHTML;

            // Check if this is a Data Sufficiency question (skip these)
            // Pattern: <br>(1) <span> and <br>(2) <span>
            var tempCheckDiv = document.createElement("div");
            tempCheckDiv.innerHTML = questionHTML;

            // Count <br> tags followed by (1) or (2)
            var brTags = tempCheckDiv.querySelectorAll('br');
            var hasDataSufficiencyPattern = false;

            brTags.forEach(function (br) {
                var nextNode = br.nextSibling;
                if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
                    var text = nextNode.textContent.trim();
                    // Check if text starts with (1) or (2)
                    if (text.match(/^\(1\)\s*/) || text.match(/^\(2\)\s*/)) {
                        hasDataSufficiencyPattern = true;
                    }
                }
            });

            // If this is a Data Sufficiency question, skip it
            if (hasDataSufficiencyPattern) {
                console.log("Skipping Data Sufficiency question (contains <br>(1) and <br>(2) pattern)");
                return null;
            }

            // Convert KaTeX to TeX format for JSON
            var tempDiv = document.createElement("div");
            tempDiv.innerHTML = questionHTML;

            // Replace <br> tags with newline markers BEFORE processing KaTeX
            // This preserves the line structure in questions with Roman numerals
            var htmlWithLineBreaks = tempDiv.innerHTML;
            // Replace double <br> tags with double newlines (paragraph breaks)
            htmlWithLineBreaks = htmlWithLineBreaks.replace(/\<br\s*\/?\>/gi, '\n\n');
            // Replace single <br> tags with single newlines
            htmlWithLineBreaks = htmlWithLineBreaks.replace(/\<br\s*\/?\>/gi, '\n');
            tempDiv.innerHTML = htmlWithLineBreaks;

            // IMPORTANT: Escape currency symbols BEFORE processing KaTeX
            // At this point, currency like $650 is plain text, while math is in .katex elements
            escapeCurrencyInElement(tempDiv);

            // Process all Katex math expressions
            var katexElements = tempDiv.querySelectorAll(".katex");
            katexElements.forEach(function (katexElem) {
                var mathml = katexElem.querySelector(".katex-mathml");
                if (mathml) {
                    var annotation = mathml.querySelector("annotation");
                    if (annotation) {
                        var texContent = annotation.textContent;

                        // Check if this katex element is inside a katex-display wrapper
                        var isDisplayMode = katexElem.closest('.katex-display') !== null;

                        var isDisplay = isDisplayMode || texContent.includes("\\dfrac") || texContent.includes("\\frac") ||
                            texContent.includes("\\int") || texContent.includes("\\sum");

                        var mathText;
                        if (isDisplayMode) {
                            // Display mode: add newlines before and after for proper separation
                            mathText = '\n\n$$' + texContent + '$$\n\n';
                        } else if (isDisplay) {
                            mathText = '$$' + texContent + '$$';
                        } else {
                            mathText = '$' + texContent + '$';
                        }

                        var mathPlaceholder = document.createTextNode(mathText);
                        katexElem.replaceWith(mathPlaceholder);
                    }
                }
            });

            // Get text content and clean up while preserving newlines
            var questionText = tempDiv.textContent;
            // Clean up excessive whitespace on each line but preserve newlines
            questionText = questionText.split('\n').map(function (line) {
                return line.trim();
            }).join('\n');
            // Remove excessive blank lines (more than 2 consecutive newlines)
            questionText = questionText.replace(/\n{3,}/g, '\n\n');
            questionText = questionText.trim();

            // Extract answer choices
            var answerChoices = [];
            var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');

            if (standardChoices) {
                var options = standardChoices.querySelectorAll('.option.ng-star-inserted, .option');

                options.forEach(function (option) {
                    var answerText = '';

                    var label = option.querySelector('label');
                    if (label) {
                        var katexElements = label.querySelectorAll('.katex');
                        if (katexElements.length > 0) {
                            var tempDiv = document.createElement("div");
                            tempDiv.innerHTML = label.innerHTML;

                            // Escape currency BEFORE KaTeX processing
                            escapeCurrencyInElement(tempDiv);

                            var katexElementsInLabel = tempDiv.querySelectorAll(".katex");
                            katexElementsInLabel.forEach(function (katexElem) {
                                var mathml = katexElem.querySelector(".katex-mathml");
                                if (mathml) {
                                    var annotation = mathml.querySelector("annotation");
                                    if (annotation) {
                                        var texContent = annotation.textContent;
                                        var mathPlaceholder = document.createTextNode("$" + texContent + "$");
                                        katexElem.replaceWith(mathPlaceholder);
                                    }
                                }
                            });

                            answerText = tempDiv.textContent.trim();
                        } else {
                            var span = label.querySelector('span');
                            if (span) {
                                answerText = span.textContent.trim();
                            } else {
                                answerText = label.textContent.trim();
                            }
                        }
                    } else {
                        answerText = option.textContent.trim();
                    }

                    if (answerText) {
                        answerText = answerText.replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
                        answerChoices.push(answerText);
                    }
                });
            }

            // Extract metadata (category, difficulty, selected/correct answers, time)
            var metadata = extractGMATHeroMetadata();

            // Create JSON structure for Quant question
            var jsonData = {
                "questionLink": getPracticeUrl(),
                "source": "GMAT HERO",
                "difficulty": metadata.difficulty || "",
                "section": "quant",
                "questionType": "quant",
                //"selectedAnswer": metadata.selectedAnswer || "",
                //"timeSpent": metadata.timeSpent || "",
                "correctAnswer": metadata.correctAnswer || "",
                "category": metadata.category || "",
                "content": {
                    "questionText": normalizeCurrency(decodeHtmlEntities(questionText)),
                    "answerChoices": answerChoices.map(function (choice) {
                        return normalizeCurrency(choice);
                    }),
                    "image": questionImage
                }
            };

            return jsonData;

        } catch (error) {
            console.error("Error extracting GMAT Hero Quant content:", error);
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

            var filename = 'gmat-quant-' + categoryPart + timestamp + '.json';
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
                    //Dont extract DS question
                    if (currentQ === totalQ) {
                        stopExtraction();
                        return;
                    }
                }
            }

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
        '<title>GMAT Quant Extractor</title>' +
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
        '<h2>GMAT Quant Question Extractor</h2>' +
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