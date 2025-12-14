/**
 * GMAT Logger Modular - GMAT Official Practice Extractor
 * Extracts RC and CR questions from gmatofficialpractice.mba.com
 */

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

/**
 * Get the current page URL
 */
function getCurrentUrl() {
    return window.location.href;
}

/**
 * Convert time format from "52 secs" or "2 mins 52 secs" to "MM:SS" format
 * Examples:
 *   "52 secs" -> "00:52"
 *   "2 mins 52 secs" -> "02:52"
 *   "1 min 5 secs" -> "01:05"
 */
function formatTimeToMMSS(timeString) {
    if (!timeString) return "";

    let minutes = 0;
    let seconds = 0;

    // Match patterns like "2 mins", "2 min", "1 minute", etc.
    const minsMatch = timeString.match(/(\d+)\s*min(s|ute|utes)?/i);
    if (minsMatch) {
        minutes = parseInt(minsMatch[1], 10);
    }

    // Match patterns like "52 secs", "52 sec", "5 seconds", etc.
    const secsMatch = timeString.match(/(\d+)\s*sec(s|ond|onds)?/i);
    if (secsMatch) {
        seconds = parseInt(secsMatch[1], 10);
    }

    // If no match found, return original string
    if (minutes === 0 && seconds === 0 && !minsMatch && !secsMatch) {
        return timeString;
    }

    // Format as MM:SS
    const formattedMins = String(minutes).padStart(2, '0');
    const formattedSecs = String(seconds).padStart(2, '0');

    return `${formattedMins}:${formattedSecs}`;
}

/**
 * Extract time spent from OG Practice page
 * Based on: <div class="time-taken-label">Time Spent:</div><span>52 secs</span>
 */
function extractTimeSpent() {
    const timeContainer = document.querySelector('.answer-time-taken');
    if (!timeContainer) {
        return "";
    }

    const timeSpan = timeContainer.querySelector('span');
    if (timeSpan) {
        const rawTime = timeSpan.textContent.trim();
        return formatTimeToMMSS(rawTime);
    }

    return "";
}

/**
 * Extract selected answer from OG Practice page
 * Based on: <div class="multi-choice incorrect" data-choice="A"></div>
 *           <div class="multi-choice correct" data-choice="A"></div> (when selected = correct)
 */
function extractSelectedAnswer() {
    // Look for incorrect answer (user got it wrong)
    const incorrectChoice = document.querySelector('.multi-choice.incorrect');
    if (incorrectChoice) {
        return incorrectChoice.getAttribute('data-choice') || "";
    }

    // Check for correct answer (user got it right - has "correct" class)
    const correctChoice = document.querySelector('.multi-choice.correct');
    if (correctChoice) {
        return correctChoice.getAttribute('data-choice') || "";
    }

    // Fallback: check for "corrected" class
    const correctedChoice = document.querySelector('.multi-choice.corrected');
    if (correctedChoice) {
        return correctedChoice.getAttribute('data-choice') || "";
    }

    return "";
}

/**
 * Extract correct answer from OG Practice page
 * Based on: <div class="multi-choice corrected" data-choice="B"></div>
 *           <div class="multi-choice correct" data-choice="A"></div> (when selected = correct)
 */
function extractCorrectAnswer() {
    // Check for "corrected" class (shows the correct answer when user was wrong)
    const correctedChoice = document.querySelector('.multi-choice.corrected');
    if (correctedChoice) {
        return correctedChoice.getAttribute('data-choice') || "";
    }

    // Check for "correct" class (user selected the correct answer)
    const correctChoice = document.querySelector('.multi-choice.correct');
    if (correctChoice) {
        return correctChoice.getAttribute('data-choice') || "";
    }

    return "";
}

/**
 * Extract category from OG Practice page
 * Based on: <div id="answer" role="region" aria-label="Solution"><h4>Inference</h4>
 */
function extractCategory() {
    const answerSection = document.querySelector('#answer');
    if (!answerSection) {
        return "";
    }

    const categoryHeader = answerSection.querySelector('h4');
    if (categoryHeader) {
        return categoryHeader.textContent.trim();
    }

    return "";
}

/**
 * Detect question section (RC or CR) from OG Practice page
 */
function detectOGSection() {
    // Check if there's a reading passage (indicates RC)
    const passageContainer = document.querySelector('.reading-passage');
    if (passageContainer) {
        return "Reading Comprehension";
    }

    // Check for CR-specific elements or patterns
    // If no passage but has question content, it's likely CR
    const questionContent = document.querySelector('#content-question-start');
    if (questionContent) {
        // Check if there's a passage div that might indicate RC
        const passageCheck = document.querySelector('#content-passage-start');
        if (passageCheck) {
            return "Reading Comprehension";
        }
        return "Critical Reasoning";
    }

    return "Unknown";
}

/**
 * Process highlighted text - convert <mark><span>text</span></mark> to ==text==
 */
function processHighlights(html) {
    // Handle marked/highlighted text
    let processed = html.replace(/<mark[^>]*><span[^>]*class="reading-passage-reference"[^>]*>(.*?)<\/span><\/mark>/gi, '==$1==');
    processed = processed.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
    return processed;
}

/**
 * Process boldface text - convert <strong>text</strong> to **text**
 */
function processBoldface(html) {
    return html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
}

/**
 * Extract highlight ranges from text with ==marker== format
 * Returns { cleanText: string, highlightRanges: [{start: number, end: number}] }
 */
function extractHighlightRanges(textWithMarkers) {
    const highlightRanges = [];
    let cleanText = '';
    let currentPos = 0;

    // Find all ==...== patterns
    const regex = /==(.*?)==/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(textWithMarkers)) !== null) {
        // Add text before the highlight
        const beforeHighlight = textWithMarkers.substring(lastIndex, match.index);
        cleanText += beforeHighlight;

        // Calculate start position in clean text
        const start = cleanText.length;

        // Add the highlighted content (without markers)
        const highlightedContent = match[1];
        cleanText += highlightedContent;

        // Calculate end position in clean text
        const end = cleanText.length;

        // Record the range
        highlightRanges.push({ start, end });

        // Update lastIndex to after the closing ==
        lastIndex = regex.lastIndex;
    }

    // Add any remaining text after the last highlight
    cleanText += textWithMarkers.substring(lastIndex);

    return { cleanText, highlightRanges };
}

/**
 * Extract RC (Reading Comprehension) question from OG Practice
 */
function extractOGRCContent() {
    try {
        // Extract passage
        const passageContainer = document.querySelector('.reading-passage');
        if (!passageContainer) {
            console.warn("Could not find OG passage container!");
            return null;
        }

        let passageHTML = passageContainer.innerHTML;

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
        let passageText = passageHTML.replace(/<[^>]*>/g, '');
        passageText = decodeHtmlEntities(passageText).trim();

        // Extract highlight ranges and clean the passage text
        const { cleanText: cleanPassage, highlightRanges } = extractHighlightRanges(passageText);
        passageText = cleanPassage;

        // Extract question
        const questionContainer = document.querySelector('#content-question-start');
        if (!questionContainer) {
            console.warn("Could not find OG question container!");
            return null;
        }

        let questionHTML = questionContainer.innerHTML;

        // Process highlights and boldface
        questionHTML = processHighlights(questionHTML);
        questionHTML = processBoldface(questionHTML);

        // Remove question ID (e.g., <p class="e_id">100454</p>)
        questionHTML = questionHTML.replace(/<p[^>]*class="e_id"[^>]*>.*?<\/p>/gi, '');

        // Remove answer choices from question HTML
        questionHTML = questionHTML.replace(/<ul[^>]*class="question-choices[^>]*>.*?<\/ul>/gis, '');

        // Extract just the question text
        let questionText = questionHTML
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]*>/g, '')
            .trim();
        questionText = decodeHtmlEntities(questionText);
        // Remove "Question" prefix if present
        questionText = questionText.replace(/^Question\s*\n*\s*/i, '').trim();

        // Extract answer choices
        const answerChoices = [];
        const choicesContainer = document.querySelector('.question-choices-multi');

        if (choicesContainer) {
            const choices = choicesContainer.querySelectorAll('li');
            choices.forEach(choice => {
                const choiceContent = choice.querySelector('.choice-content');
                if (choiceContent) {
                    let choiceHTML = choiceContent.innerHTML;
                    choiceHTML = processBoldface(choiceHTML);
                    choiceHTML = processHighlights(choiceHTML);
                    let choiceText = choiceHTML.replace(/<[^>]*>/g, '').trim();
                    answerChoices.push(decodeHtmlEntities(choiceText));
                }
            });
        }

        // Extract metadata
        const timeSpent = extractTimeSpent();
        const selectedAnswer = extractSelectedAnswer();
        const correctAnswer = extractCorrectAnswer();
        const category = "rc"//extractCategory();

        // Create JSON structure for RC question
        const jsonData = {
            "questionLink": getCurrentUrl(),
            "source": "GMAT Official",
            "questionType": "rc",
            "difficulty": "",
            "section": "verbal",
            "selectedAnswer": selectedAnswer,
            "correctAnswer": correctAnswer,
            "timeSpent": timeSpent,
            "category": category || "rc",
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

/**
 * Extract CR (Critical Reasoning) question from OG Practice
 */
function extractOGCRContent() {
    try {
        // For CR, the passage is embedded in the question content
        const questionContainer = document.querySelector('#content-question-start');
        if (!questionContainer) {
            console.warn("Could not find OG question container!");
            return null;
        }

        let fullHTML = questionContainer.innerHTML;

        // Process highlights and boldface
        fullHTML = processHighlights(fullHTML);
        fullHTML = processBoldface(fullHTML);

        // Remove question ID
        fullHTML = fullHTML.replace(/<p[^>]*class="e_id"[^>]*>.*?<\/p>/gi, '');

        // Remove answer choices
        fullHTML = fullHTML.replace(/<ul[^>]*class="question-choices[^>]*>.*?<\/ul>/gis, '');

        // Split into paragraphs
        let textContent = fullHTML
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .trim();

        textContent = decodeHtmlEntities(textContent);
        // Remove "Question" prefix if present
        textContent = textContent.replace(/^Question\s*\n*\s*/i, '').trim();

        // Split into parts to separate passage from question
        const parts = textContent.split('\n\n').filter(p => p.trim().length > 0);

        let passage = "";
        let questionText = "";

        // Check for "Complete the Argument" type questions
        // These have the question prompt first (ends with ?) and the passage/argument after (contains __________)
        let isCompleteArgument = false;
        let blankIndex = -1;
        for (let i = 0; i < parts.length; i++) {
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
            let questionIndex = -1;
            for (let i = parts.length - 1; i >= 0; i--) {
                const part = parts[i].trim();
                if (part.includes("?")) {
                    const lowerPart = part.toLowerCase();
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
                for (let i = parts.length - 1; i >= 0; i--) {
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
        const answerChoices = [];
        const choicesContainer = document.querySelector('.question-choices-multi');

        if (choicesContainer) {
            const choices = choicesContainer.querySelectorAll('li');
            choices.forEach(choice => {
                const choiceContent = choice.querySelector('.choice-content');
                if (choiceContent) {
                    let choiceHTML = choiceContent.innerHTML;
                    choiceHTML = processBoldface(choiceHTML);
                    choiceHTML = processHighlights(choiceHTML);
                    let choiceText = choiceHTML.replace(/<[^>]*>/g, '').trim();
                    answerChoices.push(decodeHtmlEntities(choiceText));
                }
            });
        }

        // Extract metadata
        const timeSpent = extractTimeSpent();
        const selectedAnswer = extractSelectedAnswer();
        const correctAnswer = extractCorrectAnswer();
        const category = ""//extractCategory();

        // Create JSON structure for CR question
        const jsonData = {
            "questionLink": getCurrentUrl(),
            "source": "GMAT Official",
            "questionType": "cr",
            "difficulty": "",
            "section": "verbal",
            "selectedAnswer": selectedAnswer,
            "correctAnswer": correctAnswer,
            "timeSpent": timeSpent,
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

/**
 * Main export: Extract question from GMAT Official Practice page
 */
export function extractGMATOGQuestion() {
    const section = detectOGSection();
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
