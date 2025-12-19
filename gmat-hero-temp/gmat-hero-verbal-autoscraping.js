javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT Question Extractor", "width=600,height=400,scrollbars=yes");

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

    /**
     * Shared patterns for sentence-completion style questions (synced with utils.js COMPLETION_PATTERNS)
     * If updating, also update: utils.js, gmatOG.js, gmathero.js, gmatclub.js, gmat-og/*.js, gmatclub/*.js
     */
    var COMPLETION_PATTERNS = [
        /\bthat\s*$/i,           // ends with "that"
        /\bto\s*$/i,             // ends with "to" 
        /\bbecause\s*$/i,        // ends with "because"
        /\bfor\s*$/i,            // ends with "for"
        /\bwhich\s*$/i,          // ends with "which"
        /\bif\s*$/i,             // ends with "if"
        /\bby\s*$/i,             // ends with "by" (e.g., "responds to the argument by")
        /\bthe following\s*$/i,  // ends with "the following"
        /\bargument that\s*$/i,  // "argument that" pattern
        /\bconclusion that\s*$/i, // "conclusion that" pattern
        /\bassumption that\s*$/i, // "assumption that" pattern
        /\bstatement that\s*$/i,  // "statement that" pattern
        /\bevidence that\s*$/i,   // "evidence that" pattern
        /\bserves? as\s*$/i,      // "serve as" / "serves as" pattern
        /\bserves? to\s*$/i,      // "serve to" / "serves to" pattern
        /\bargument by\s*$/i,     // "argument by" pattern
        /\bresponds? to\s*$/i,    // "respond to" / "responds to" pattern (when at end)
    ];

    function isCompletionStyleQuestion(text) {
        if (!text || typeof text !== 'string') return false;
        var trimmed = text.trim();
        for (var i = 0; i < COMPLETION_PATTERNS.length; i++) {
            if (COMPLETION_PATTERNS[i].test(trimmed)) return true;
        }
        return false;
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
        
        // Check for RC questions first
        if (url.includes('rc') || url.includes('rrc') || url.includes('og-rc') || url.includes('prep-rc')) {
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
        } 
        // Check for CR questions
        else if (url.includes('og-quant') || url.includes('prep-quant') ||
                 url.includes('og-cr') || url.includes('prep-cr')) {
            if (categoryEl) {
                var fullText = categoryEl.textContent.trim();
                var parts = fullText.split('-');
                if (parts.length > 1) {
                    metadata.category = parts[parts.length - 1].trim();
                } else {
                    metadata.category = fullText;
                }
            }
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

    // Helper function to convert styled spans to markdown format
    function convertStyledSpansToMarkdown(htmlContent) {
        // Replace <span> tags with appropriate markdown formatting
        var result = htmlContent;

        // Match span tags and replace based on style
        result = result.replace(/<span[^>]*>(.*?)<\/span>/gi, function (match, content) {
            // Check if it's italic (font-style: italic)
            if (match.includes('font-style: italic') || match.includes('font-style:italic')) {
                return '*' + content + '*';
            }
            // Otherwise treat as bold (font-weight: bold or default for boldface questions)
            return '**' + content + '**';
        });

        return result;
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

    // Function to determine if this is an RC question
    function isRCQuestion() {
        var url = window.location.href.toLowerCase();
        return url.includes('rc') || url.includes('rrc') || url.includes('og-rc') || url.includes('prep-rc') ||
               document.getElementById('left-panel') !== null;
    }

    // Function to extract RC data from current question
    function extractRCQuestionData() {
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
            console.error("Error occurred while extracting RC question data: " + (error.message || error));
            return null;
        }
    }

    // Function to extract CR data from current question
    function extractCRQuestionData() {
        try {
            // Find the main content container
            var testContent = document.getElementById('test-content');
            if (!testContent) {
                console.error("Could not find the test-content element!");
                return null;
            }

            // Find the right panel
            var rightPanel = testContent.querySelector('#right-panel');
            if (!rightPanel) {
                console.error("Could not find the right-panel element!");
                return null;
            }

            // Extract passage and question from question-stem
            var questionStem = rightPanel.querySelector('.question-stem');
            if (!questionStem) {
                console.error("Could not find the question-stem element!");
                return null;
            }

            // Get all content from question-stem
            var stemContent = questionStem.innerHTML;

            // Extract metadata first to check question type
            var metadata = extractGMATHeroMetadata();
            var isBoldfaceQuestion = metadata.category && metadata.category.toLowerCase().includes('boldface');
            var isCompleteArgumentQuestion = metadata.category && metadata.category.toLowerCase().includes('complete');

            // If it's a Boldface or Complete the Argument question, convert styled spans to markdown
            if (isBoldfaceQuestion || isCompleteArgumentQuestion) {
                stemContent = convertStyledSpansToMarkdown(stemContent);
            }

            // Split by <br> tags to separate passage from question
            var parts = stemContent.split(/<br\s*\/?>/gi);

            var passage = "";
            var question = "";

            // Special handling for "Complete the Argument" questions
            if (isCompleteArgumentQuestion) {
                // For "Complete the Argument", the first part is the question stem
                // Everything after the first <br> is the passage
                // Note: HTML often has multiple <br> tags, creating empty parts

                // Filter out empty parts
                var nonEmptyParts = [];
                for (var i = 0; i < parts.length; i++) {
                    var trimmed = parts[i].trim();
                    if (trimmed.length > 0) {
                        nonEmptyParts.push(trimmed);
                    }
                }

                if (nonEmptyParts.length > 0) {
                    // First non-empty part is the question
                    question = nonEmptyParts[0];
                    question = question
                        .replace(/<[^>]*>/g, '')
                        .replace(/&ldquo;/g, '"')
                        .replace(/&rdquo;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&[a-zA-Z0-9#]+;/g, '')
                        .trim();

                    // Rest is the passage (join remaining non-empty parts)
                    if (nonEmptyParts.length > 1) {
                        var passageParts = nonEmptyParts.slice(1);
                        passage = passageParts.join(" ");
                        passage = passage
                            .replace(/<[^>]*>/g, '')
                            .replace(/&ldquo;/g, '"')
                            .replace(/&rdquo;/g, '"')
                            .replace(/&amp;/g, '&')
                            .replace(/&[a-zA-Z0-9#]+;/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                    }
                }
            } else {
                // Original logic for other question types
                // Find the question - look for specific question patterns (search backwards)
                var questionIndex = -1;
                for (var i = parts.length - 1; i >= 0; i--) {
                    var part = parts[i].trim();
                    if (part.length > 0) {
                        // Look for common question patterns in CR questions
                        var cleanPart = part
                            .replace(/<[^>]*>/g, '')
                            .replace(/&ldquo;/g, '"')
                            .replace(/&rdquo;/g, '"')
                            .replace(/&amp;/g, '&')
                            .replace(/&[a-zA-Z0-9#]+;/g, '')
                            .trim();

                        // Check for typical CR question patterns
                        if (cleanPart.includes("?")) {
                            var lowerPart = cleanPart.toLowerCase();
                            if (lowerPart.includes("which") ||
                                lowerPart.includes("what") ||
                                lowerPart.includes("how") ||
                                lowerPart.includes("why") ||
                                lowerPart.includes("except") ||
                                lowerPart.includes("vulnerable") ||
                                lowerPart.includes("flaw") ||
                                lowerPart.includes("assumption") ||
                                lowerPart.includes("conclusion") ||
                                lowerPart.includes("inference") ||
                                lowerPart.includes("strengthen") ||
                                lowerPart.includes("weaken")) {
                                questionIndex = i;
                                question = cleanPart;
                                break;
                            }
                        }
                    }
                }

                // Fallback: if we didn't find a specific pattern, look for any text ending with ?
                if (questionIndex === -1) {
                    for (var i = parts.length - 1; i >= 0; i--) {
                        var part = parts[i].trim();
                        if (part.length > 0) {
                            var cleanPart = part
                                .replace(/<[^>]*>/g, '')
                                .replace(/&ldquo;/g, '"')
                                .replace(/&rdquo;/g, '"')
                                .replace(/&amp;/g, '&')
                                .replace(/&[a-zA-Z0-9#]+;/g, '')
                                .trim();
                            if (cleanPart.includes("?")) {
                                questionIndex = i;
                                question = cleanPart;
                                break;
                            }
                        }
                    }
                }

                // Edge case: Sentence-completion style questions without question mark
                // Uses shared isCompletionStyleQuestion utility
                if (questionIndex === -1) {
                    for (var i = parts.length - 1; i >= 0; i--) {
                        var part = parts[i].trim();
                        if (part.length > 0) {
                            var cleanPart = part
                                .replace(/<[^>]*>/g, '')
                                .replace(/&ldquo;/g, '"')
                                .replace(/&rdquo;/g, '"')
                                .replace(/&amp;/g, '&')
                                .replace(/&[a-zA-Z0-9#]+;/g, '')
                                .trim();
                            if (isCompletionStyleQuestion(cleanPart)) {
                                questionIndex = i;
                                question = cleanPart;
                                console.log("Detected sentence-completion question pattern:", cleanPart);
                                break;
                            }
                        }
                    }
                }

                // Build passage from parts before the question
                if (questionIndex >= 0) {
                    var passageParts = parts.slice(0, questionIndex);
                    passage = passageParts.join(" ").trim();
                } else {
                    // If no question found, treat everything as passage
                    passage = stemContent;
                }

                // Clean up passage (note: for styled questions, markdown markers are already in place)
                passage = passage
                    .replace(/<[^>]*>/g, '')
                    .replace(/&ldquo;/g, '"')
                    .replace(/&rdquo;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&[a-zA-Z0-9#]+;/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            // Decode HTML entities
            passage = decodeHtmlEntities(passage);
            question = decodeHtmlEntities(question);

            // Extract answer choices
            var answerChoices = [];
            var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');

            if (standardChoices) {
                var options = standardChoices.querySelectorAll('.option.ng-star-inserted');
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

            // Note: metadata was already extracted earlier to check for Boldface questions

            // Create JSON structure for CR question
            var jsonData = {
                "questionLink": getPracticeUrl(),
                "source": "og",
                "difficulty": metadata.difficulty || "",
                "section": "verbal",
                "questionType": "cr",
                "correctAnswer": metadata.correctAnswer || "",
                "category": metadata.category || "",
                "content": {
                    "passage": passage,
                    "questionText": question,
                    "answerChoices": answerChoices,
                }
            };

            return jsonData;
        } catch (error) {
            console.error("Error occurred while extracting CR question data: " + (error.message || error));
            return null;
        }
    }

    // Function to extract data from current question (detects question type automatically)
    function extractQuestionData() {
        if (isRCQuestion()) {
            return extractRCQuestionData();
        } else {
            return extractCRQuestionData();
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
            var questionType = "question";
            
            if (extractedQuestions.length > 0) {
                // Determine question type from first question
                questionType = extractedQuestions[0].questionType || "question";
                
                // Get category/topic
                var categoryOrTopic = extractedQuestions[0].topic || extractedQuestions[0].category;
                if (categoryOrTopic) {
                    categoryPart = categoryOrTopic
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .split(/\s+/)
                        .join('-');

                    if (categoryPart) {
                        categoryPart += '-';
                    }
                }
            }

            var filename = 'gmat-' + questionType + '-' + categoryPart + timestamp + '.json';

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
        '<title>GMAT Question Extractor</title>' +
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
        '<h2>GMAT Question Extractor</h2>' +
        '<div class="instructions">' +
        '<p><strong>Instructions:</strong></p>' +
        '<ol>' +
        '<li>Click "Start" to begin extracting questions</li>' +
        '<li>The script will automatically detect question type (CR/RC) and navigate through questions</li>' +
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