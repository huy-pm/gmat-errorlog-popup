javascript: (function() {
    // Create popup window first
    var popup = window.open("", "GMAT CR Extractor", "width=600,height=400,scrollbars=yes");
    
    // Global variables to store extracted questions and control the process
    var extractedQuestions = [];
    var isRunning = false;
    var intervalId = null;
    var startTime = null;
    
    // Function to extract data from current question
    function extractQuestionData() {
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
            
            // Split by <br> tags to separate passage from question
            var parts = stemContent.split(/<br\s*\/?>/gi);
            
            var passage = "";
            var question = "";
            
            // Find the question - look for specific question patterns
            var questionIndex = -1;
            for (var i = parts.length - 1; i >= 0; i--) {
                var part = parts[i].trim();
                if (part.length > 0) {
                    // Look for common question patterns in CR questions
                    var cleanPart = part
                        .replace(/<[^>]*>/g, '')                 // Remove HTML tags
                        .replace(/&ldquo;/g, '"')                // Convert HTML entities
                        .replace(/&rdquo;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
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
                            .replace(/<[^>]*>/g, '')                 // Remove HTML tags
                            .replace(/&ldquo;/g, '"')                // Convert HTML entities
                            .replace(/&rdquo;/g, '"')
                            .replace(/&amp;/g, '&')
                            .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
                            .trim();
                        if (cleanPart.includes("?")) {
                            questionIndex = i;
                            question = cleanPart;
                            break;
                        }
                    }
                }
            }
            
            // Build passage from parts before the question
            if (questionIndex >= 0) {
                var passageParts = parts.slice(0, questionIndex + 1); // Include the part with the question mark
                passage = passageParts.join(" ").trim();
                
                // Remove the question from the passage
                var questionWithTags = parts[questionIndex];
                passage = passage.replace(questionWithTags, '').trim();
            } else {
                // If no question found, treat everything as passage
                passage = stemContent;
            }
            
            // Clean up passage
            passage = passage
                .replace(/<[^>]*>/g, '')                 // Remove HTML tags
                .replace(/&ldquo;/g, '"')                // Convert HTML entities
                .replace(/&rdquo;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
                .replace(/\s+/g, ' ')                   // Normalize whitespace
                .trim();
            
            // Extract answer choices
            var answerChoices = [];
            var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');
            
            if (standardChoices) {
                var options = standardChoices.querySelectorAll('.option.ng-star-inserted');
                options.forEach(function(option) {
                    var label = option.querySelector('label');
                    if (label) {
                        var span = label.querySelector('span');
                        if (span) {
                            var answerText = span.textContent.trim();
                            if (answerText) {
                                answerChoices.push(answerText);
                            }
                        }
                    }
                });
            }
            
            // Format answers as A. [choice], B. [choice], etc.
            var formattedAnswers = answerChoices.map(function(choice, index) {
                var letter = String.fromCharCode(65 + index); // A, B, C, D, E
                return letter + ". " + choice;
            });
            
            // Return extracted data
            return {
                passage: passage,
                question: question,
                answers: formattedAnswers
            };
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
            navElements.forEach(function(element) {
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
    
    // Function to save questions to JSON file
    function saveQuestionsToJSON() {
        try {
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            var filename = 'gmat-cr-' + timestamp + '.json';
            var jsonData = JSON.stringify(extractedQuestions, null, 2);
            
            var blob = new Blob([jsonData], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(function() {
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
        intervalId = setInterval(function() {
            if (!isRunning) return;
            
            // Extract current question
            var questionData = extractQuestionData();
            if (questionData) {
                extractedQuestions.push(questionData);
                popup.document.getElementById('count').textContent = extractedQuestions.length;
            }
            
            // Click next button
            var hasNext = clickNextButton();
            
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
            '<title>GMAT CR Extractor</title>' +
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
            '<h2>GMAT CR Question Extractor</h2>' +
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
    window.saveQuestionsToJSON = saveQuestionsToJSON;
})();