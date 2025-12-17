javascript: (function () {
    // Create popup window first
    var popup = window.open("", "GMAT OG Advanced Extractor", "width=600,height=450,scrollbars=yes");

    // Global variables to store extracted questions and control the process
    var extractedQuestions = [];
    var isRunning = false;
    var startTime = null;
    var currentQuestionIndex = 0;
    var currentPageQuestions = [];
    var currentDifficulty = "";
    var totalProcessed = 0;  // Track total processed (success + fail)
    var failedCount = 0;     // Track failed extractions
    var currentPageNumber = 1;  // Track which pagination page we're on

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
        // Primary method: Check for "corrected" class (shows the correct answer when user was wrong)
        var correctedChoice = document.querySelector('.multi-choice.corrected');
        if (correctedChoice) {
            return correctedChoice.getAttribute('data-choice') || "";
        }

        // Primary method: Check for "correct" class (user selected the correct answer)
        var correctChoice = document.querySelector('.multi-choice.correct');
        if (correctChoice) {
            return correctChoice.getAttribute('data-choice') || "";
        }

        // Backup method: Look for "The correct answer is X." in the explanation section
        var answerSection = document.querySelector('#answer');
        if (answerSection) {
            var answerText = answerSection.textContent || answerSection.innerText;
            var match = answerText.match(/The correct answer is ([A-E])\./i);
            if (match) {
                return match[1].toUpperCase();
            }
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
            var category = "RC"//extractCategory();

            // Create JSON structure for RC question
            var jsonData = {
                "questionLink": getCurrentUrl(),
                "source": "GMAT Official",
                "difficulty": currentDifficulty, // Use difficulty from list page
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

                // Edge case: Sentence-completion style questions without question mark
                // These are incomplete sentences that the answer choices complete
                // Examples: "...best serves as part of an argument that", "...most strongly supports which of the following"
                if (questionIndex === -1) {
                    // Look for patterns that indicate a stem/completion question
                    var completionPatterns = [
                        /\bthat\s*$/i,           // ends with "that"
                        /\bto\s*$/i,             // ends with "to" 
                        /\bbecause\s*$/i,        // ends with "because"
                        /\bfor\s*$/i,            // ends with "for"
                        /\bwhich\s*$/i,          // ends with "which"
                        /\bif\s*$/i,             // ends with "if"
                        /\bthe following\s*$/i,  // ends with "the following"
                        /\bargument that\s*$/i,  // "argument that" pattern
                        /\bconclusion that\s*$/i, // "conclusion that" pattern
                        /\bassumption that\s*$/i, // "assumption that" pattern
                        /\bstatement that\s*$/i,  // "statement that" pattern
                        /\bevidence that\s*$/i,   // "evidence that" pattern
                        /\bserves? as\s*$/i,      // "serve as" / "serves as" pattern
                        /\bserves? to\s*$/i       // "serve to" / "serves to" pattern
                    ];

                    for (var i = parts.length - 1; i >= 0; i--) {
                        var part = parts[i].trim();
                        // Check if this part matches any completion pattern
                        for (var j = 0; j < completionPatterns.length; j++) {
                            if (completionPatterns[j].test(part)) {
                                questionIndex = i;
                                questionText = part;
                                console.log("Detected sentence-completion question pattern:", part);
                                break;
                            }
                        }
                        if (questionIndex !== -1) break;
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
            var category = ""//extractCategory();

            // Create JSON structure for CR question
            var jsonData = {
                "questionLink": getCurrentUrl(),
                "source": "GMAT Official",
                "difficulty": currentDifficulty, // Use difficulty from list page
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
    // STEP 1: LIST PAGE FUNCTIONS
    // ============================================

    // Get all question rows from the list page
    function getQuestionRows() {
        return document.querySelectorAll('li.content[data-content-location]');
    }

    // Extract difficulty from a question row
    function extractDifficultyFromRow(row) {
        var difficultyCell = row.querySelector('.li-cell.difficulty');
        if (!difficultyCell) return "";

        var classList = difficultyCell.className;
        if (classList.includes('hard')) return "Hard";
        if (classList.includes('medium')) return "Medium";
        if (classList.includes('easy')) return "Easy";

        // Fallback: get text content
        return difficultyCell.textContent.trim();
    }

    // Get the review link from a question row
    function getReviewLink(row) {
        var actionCell = row.querySelector('.li-cell.action');
        if (!actionCell) return null;

        // Look for the Review link (a.link)
        var reviewLink = actionCell.querySelector('a.link');

        // Check if the link has 'hidden' class (not reviewable)
        if (reviewLink && reviewLink.classList.contains('hidden')) {
            return null;
        }

        return reviewLink;
    }

    // Check if we're on the list page
    function isOnListPage() {
        return document.querySelector('li.content[data-content-location]') !== null;
    }

    // Check if we're on a question detail page
    function isOnQuestionPage() {
        return document.querySelector('#content-question-start') !== null;
    }

    // ============================================
    // STEP 2: NAVIGATION FUNCTIONS
    // ============================================

    // Click the "Done Reviewing" button to return to list page
    function clickDoneReviewing() {
        var doneButton = document.querySelector('a.quit.btn-cancel');
        if (doneButton) {
            doneButton.click();
            console.log("Clicked 'Done Reviewing' button");
            return true;
        }
        console.warn("Could not find 'Done Reviewing' button");
        return false;
    }

    // Check if there's a next page in pagination
    function hasNextPage() {
        var nextLink = document.querySelector('.answers-pagination a.page-link.next');
        return nextLink !== null;
    }

    // Click the next page link
    function clickNextPage() {
        var nextLink = document.querySelector('.answers-pagination a.page-link.next');
        if (nextLink) {
            nextLink.click();
            console.log("Clicked 'Next' page link");
            return true;
        }
        return false;
    }

    // Get pagination info
    function getPaginationInfo() {
        var countDiv = document.querySelector('.answers-displayed-count');
        if (countDiv) {
            // "Displaying 1 - 10 of 14"
            var text = countDiv.textContent.trim();
            var match = text.match(/Displaying\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i);
            if (match) {
                return {
                    start: parseInt(match[1], 10),
                    end: parseInt(match[2], 10),
                    total: parseInt(match[3], 10)
                };
            }
        }
        return null;
    }

    // Get current page number from pagination
    function getCurrentPageFromPagination() {
        var activePageLink = document.querySelector('.answers-pagination li.active span.current:not(.prev)');
        if (activePageLink) {
            var pageNum = parseInt(activePageLink.textContent.trim(), 10);
            if (!isNaN(pageNum)) {
                return pageNum;
            }
        }
        return 1;
    }

    // Navigate to a specific page number
    function navigateToPage(targetPage) {
        var currentPage = getCurrentPageFromPagination();
        if (currentPage === targetPage) {
            return true; // Already on correct page
        }

        // Look for the page link
        var pageLinks = document.querySelectorAll('.answers-pagination a.page-link');
        for (var i = 0; i < pageLinks.length; i++) {
            var linkText = pageLinks[i].textContent.trim();
            if (linkText === String(targetPage)) {
                pageLinks[i].click();
                console.log("Navigated to page " + targetPage);
                return true;
            }
        }

        // If target page not directly clickable, use Next button repeatedly
        if (targetPage > currentPage && hasNextPage()) {
            clickNextPage();
            return false; // Need more clicks
        }

        return false;
    }

    // ============================================
    // MAIN EXTRACTION LOOP
    // ============================================

    function updateStatus(message) {
        if (popup && !popup.closed) {
            popup.document.getElementById('status').textContent = message;
        }
        console.log("Status:", message);
    }

    function updateCount() {
        if (popup && !popup.closed) {
            popup.document.getElementById('success-count').textContent = extractedQuestions.length;
            popup.document.getElementById('skipped-count').textContent = failedCount;
            popup.document.getElementById('total-count').textContent = totalProcessed;
        }
    }

    // Process a single question from the list
    function processCurrentQuestion() {
        if (!isRunning) return;

        // Make sure we're on the list page
        if (!isOnListPage()) {
            updateStatus("Waiting for list page...");
            setTimeout(processCurrentQuestion, 1000);
            return;
        }

        // Get pagination info to know total questions
        var paginationInfo = getPaginationInfo();
        var totalQuestions = paginationInfo ? paginationInfo.total : 0;

        // Check if we've processed all questions (success + fail)
        if (totalQuestions > 0 && totalProcessed >= totalQuestions) {
            updateStatus("Completed! Extracted " + extractedQuestions.length + "/" + totalQuestions + " (" + failedCount + " skipped)");
            stopExtraction();
            return;
        }

        // Get current page's question rows
        currentPageQuestions = getQuestionRows();

        // Check if we've processed all questions on this page
        if (currentQuestionIndex >= currentPageQuestions.length) {
            // Try to go to next page
            if (hasNextPage()) {
                updateStatus("Going to next page...");
                currentQuestionIndex = 0;
                currentPageNumber++;  // Track page number
                clickNextPage();
                setTimeout(processCurrentQuestion, 3000); // Wait for page to load
                return;
            } else {
                // No more pages, we're done
                updateStatus("Completed! Extracted " + extractedQuestions.length + " questions.");
                stopExtraction();
                return;
            }
        }

        var row = currentPageQuestions[currentQuestionIndex];
        var questionNumber = paginationInfo ? paginationInfo.start + currentQuestionIndex : currentQuestionIndex + 1;

        updateStatus("Processing question " + questionNumber + " of " + totalQuestions);

        // Extract difficulty from the row
        currentDifficulty = extractDifficultyFromRow(row);
        console.log("Extracted difficulty:", currentDifficulty);

        // Get the review link
        var reviewLink = getReviewLink(row);
        if (!reviewLink) {
            console.warn("No review link found for question " + questionNumber + ", skipping...");
            totalProcessed++;  // Count as processed (failed)
            failedCount++;
            updateCount();
            currentQuestionIndex++;
            setTimeout(processCurrentQuestion, 500);
            return;
        }

        // Store current page number before navigating to detail
        currentPageNumber = getCurrentPageFromPagination();
        console.log("On page " + currentPageNumber + ", clicking review link for question " + questionNumber);

        // Click the review link to navigate to question detail
        reviewLink.click();

        // Wait for question page to load, then extract
        setTimeout(extractFromQuestionPage, 2500);
    }

    // Extract data from the question detail page
    function extractFromQuestionPage() {
        if (!isRunning) return;

        // Make sure we're on the question page
        if (!isOnQuestionPage()) {
            updateStatus("Waiting for question page...");
            setTimeout(extractFromQuestionPage, 1000);
            return;
        }

        // Extract question data
        var questionData = extractQuestionData();
        if (questionData) {
            // Check for duplicates based on questionLink
            var isDuplicate = extractedQuestions.some(function (q) {
                return q.questionLink === questionData.questionLink;
            });

            if (isDuplicate) {
                console.log("Skipping duplicate question:", questionData.questionLink);
            } else {
                extractedQuestions.push(questionData);
                updateCount();
                console.log("Extracted question:", questionData.questionLink);
            }
            totalProcessed++;  // Count as processed (success)
            updateCount();
        } else {
            console.warn("Failed to extract question data");
            totalProcessed++;  // Count as processed (failed)
            failedCount++;
            updateCount();
        }

        // Use browser back to return to list page
        updateStatus("Returning to list page " + currentPageNumber + "...");
        history.back();

        // Move to next question
        currentQuestionIndex++;

        // Wait for list page to reload, then check if we need to navigate to correct page
        setTimeout(function () {
            ensureCorrectPageAndContinue();
        }, 2500);
    }

    // Ensure we're on the correct page after history.back()
    function ensureCorrectPageAndContinue() {
        if (!isRunning) return;

        // Make sure we're on the list page
        if (!isOnListPage()) {
            updateStatus("Waiting for list page...");
            setTimeout(ensureCorrectPageAndContinue, 1000);
            return;
        }

        // Check current page vs expected page
        var actualPage = getCurrentPageFromPagination();

        if (actualPage !== currentPageNumber) {
            updateStatus("Navigating back to page " + currentPageNumber + "...");
            navigateToPage(currentPageNumber);
            setTimeout(ensureCorrectPageAndContinue, 2000);
            return;
        }

        // We're on the correct page, continue processing
        processCurrentQuestion();
    }

    // ============================================
    // CONTROL FUNCTIONS
    // ============================================

    function startExtraction() {
        if (isRunning) return;

        isRunning = true;
        startTime = new Date();
        extractedQuestions = [];
        currentQuestionIndex = 0;
        currentDifficulty = "";
        totalProcessed = 0;
        failedCount = 0;
        currentPageNumber = 1;

        // Update UI
        popup.document.getElementById('start-btn').disabled = true;
        popup.document.getElementById('stop-btn').disabled = false;
        popup.document.getElementById('status').textContent = 'Starting...';
        popup.document.getElementById('status').style.color = 'green';

        // Start the extraction process
        processCurrentQuestion();
    }

    function stopExtraction() {
        isRunning = false;

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

            var filename = 'gmat-og-advanced-' + categoryPart + timestamp + '.json';

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

    // ============================================
    // POPUP UI
    // ============================================

    // Write the popup content
    popup.document.write(
        '<html>' +
        '<head>' +
        '<title>GMAT OG Advanced Extractor</title>' +
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
        '.feature { background: #e3f2fd; padding: 10px; border-left: 4px solid #2196F3; margin: 10px 0; }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<h2>GMAT OG Advanced Extractor</h2>' +
        '<div class="feature">' +
        '<p><strong>New Features:</strong></p>' +
        '<ul>' +
        '<li>Extracts difficulty from the question list</li>' +
        '<li>Automatically clicks Review links</li>' +
        '<li>Handles pagination across multiple pages</li>' +
        '</ul>' +
        '</div>' +
        '<div class="instructions">' +
        '<p><strong>Instructions:</strong></p>' +
        '<ol>' +
        '<li>Navigate to a GMAT OG quiz review page with the question list</li>' +
        '<li>Click "Start" to begin extracting questions</li>' +
        '<li>The script will automatically navigate through all questions</li>' +
        '<li>Click "Stop" to stop early and save extracted questions</li>' +
        '</ol>' +
        '</div>' +
        '<div class="controls">' +
        '<button id="start-btn" onclick="window.opener.startAdvancedExtraction()">Start</button>' +
        '<button id="stop-btn" onclick="window.opener.stopAdvancedExtraction()" disabled>Stop</button>' +
        '</div>' +
        '<div class="status">Status: <span id="status">Ready</span></div>' +
        '<div class="count">Success: <span id="success-count" style="color:#4CAF50">0</span> | Skipped: <span id="skipped-count" style="color:#f44336">0</span> | Total: <span id="total-count">0</span></div>' +
        '</body>' +
        '</html>'
    );

    // Attach functions to the window object so they can be accessed by the popup
    window.startAdvancedExtraction = startExtraction;
    window.stopAdvancedExtraction = stopExtraction;
})();
