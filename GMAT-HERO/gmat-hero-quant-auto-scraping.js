javascript: (function() {
    // Create popup window first
    var popup = window.open("", "GMAT Quant Extractor", "width=600,height=400,scrollbars=yes");
    
    // Global variables to store extracted questions and control the process
    var extractedQuestions = [];
    var isRunning = false;
    var intervalId = null;
    var startTime = null;
    
    // Function to extract data from current question
    function extractQuestionData() {
        try {
            // Find the right panel
            var rightPanel = document.getElementById('right-panel');
            if (!rightPanel) {
                console.error("Could not find the right-panel element!");
                return null;
            }
            
            // Extract question from question-stem
            var questionStem = rightPanel.querySelector('.question-stem');
            if (!questionStem) {
                console.error("Could not find the question-stem element!");
                return null;
            }
            
            // Get the innerHTML which contains the KaTeX math expressions
            var questionHTML = questionStem.innerHTML;
            
            // Convert KaTeX to standard math format (same logic as manual extraction)
            var tempDiv = document.createElement("div");
            tempDiv.innerHTML = questionHTML;
            
            // Process all Katex math expressions
            var katexElements = tempDiv.querySelectorAll(".katex");
            katexElements.forEach(function(katexElem) {
                var mathml = katexElem.querySelector(".katex-mathml");
                if (mathml) {
                    var annotation = mathml.querySelector("annotation");
                    if (annotation) {
                        var texContent = annotation.textContent;
                        // Determine if display or inline math based on content patterns
                        var isDisplay = texContent.includes("\\dfrac") || texContent.includes("\\frac") || texContent.includes("\\int") || texContent.includes("\\sum");
                        var mathPlaceholder = document.createTextNode(isDisplay ? "$$" + texContent + "$$" : "$" + texContent + "$");
                        katexElem.replaceWith(mathPlaceholder);
                    }
                }
            });
            
            // Get the cleaned question text
            var questionText = tempDiv.textContent;
            
            // Extract answer choices with improved logic
            var answerChoices = [];
            var standardChoices = rightPanel.querySelector('.standard-choices.ng-star-inserted');
            
            if (standardChoices) {
                // Try multiple selectors to find answer options
                var options = standardChoices.querySelectorAll('.option.ng-star-inserted, .option');
                
                // If no options found with those selectors, try a more general approach
                if (options.length === 0) {
                    options = standardChoices.querySelectorAll('[class*="option"]');
                }
                
                options.forEach(function(option) {
                    // Try different structures for finding answer content
                    var answerText = '';
                    
                    // Method 1: Look for label with span containing katex
                    var label = option.querySelector('label');
                    if (label) {
                        // Check if label contains katex elements
                        var katexElements = label.querySelectorAll('.katex');
                        if (katexElements.length > 0) {
                            // Extract math content from katex elements
                            var tempDiv = document.createElement("div");
                            tempDiv.innerHTML = label.innerHTML;
                            
                            // Process all Katex math expressions
                            var katexElementsInLabel = tempDiv.querySelectorAll(".katex");
                            katexElementsInLabel.forEach(function(katexElem) {
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
                            // Fallback to regular text extraction
                            var span = label.querySelector('span');
                            if (span) {
                                answerText = span.textContent.trim();
                            } else {
                                answerText = label.textContent.trim();
                            }
                        }
                    } 
                    // Method 2: Direct text content if no label found
                    else {
                        answerText = option.textContent.trim();
                    }
                    
                    // Method 3: Check for input and associated label
                    if (!answerText) {
                        var input = option.querySelector('input');
                        if (input && input.id) {
                            var associatedLabel = document.querySelector('label[for="' + input.id + '"]');
                            if (associatedLabel) {
                                // Check if label contains katex elements
                                var katexElements = associatedLabel.querySelectorAll('.katex');
                                if (katexElements.length > 0) {
                                    // Extract math content from katex elements
                                    var tempDiv = document.createElement("div");
                                    tempDiv.innerHTML = associatedLabel.innerHTML;
                                    
                                    // Process all Katex math expressions
                                    var katexElementsInLabel = tempDiv.querySelectorAll(".katex");
                                    katexElementsInLabel.forEach(function(katexElem) {
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
                                    answerText = associatedLabel.textContent.trim();
                                }
                            }
                        }
                    }
                    
                    if (answerText) {
                        // Clean up the answer text by removing any leading characters that aren't part of the answer
                        answerText = answerText.replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
                        answerChoices.push(answerText);
                    }
                });
            }
            
            // If we still don't have answer choices, try a different approach
            if (answerChoices.length === 0) {
                // Look for any elements that might contain answer choices
                var possibleChoiceContainers = rightPanel.querySelectorAll('[class*="choice"], [class*="option"], [class*="answer"]');
                possibleChoiceContainers.forEach(function(container) {
                    var text = container.textContent.trim();
                    // Check if this looks like an answer choice (starts with A, B, C, D, E followed by . or )
                    if (text.match(/^[A-Ea-e][\.\)]/)) {
                        var cleanedText = text.replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
                        if (cleanedText && answerChoices.indexOf(cleanedText) === -1) {
                            answerChoices.push(cleanedText);
                        }
                    }
                });
            }
            
            // Format answers as A. [choice], B. [choice], etc.
            // var formattedAnswers = answerChoices.map(function(choice, index) {
            //     var letter = String.fromCharCode(65 + index); // A, B, C, D, E
            //     return letter + ". " + choice;
            // });
            
            // Get current page URL as question link
            var questionLink = window.location.href;
            
            // Return extracted data
            return {
                question: questionText,
                answer_choices: answerChoices,
                link: questionLink
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
            var filename = 'gmat-quant-' + timestamp + '.json';
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
    window.saveQuestionsToJSON = saveQuestionsToJSON;
})();