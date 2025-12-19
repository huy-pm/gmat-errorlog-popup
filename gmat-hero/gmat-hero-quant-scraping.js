javascript: (function() {
    try {
        // Find the right panel
        var rightPanel = document.getElementById('right-panel');
        if (!rightPanel) {
            alert("Could not find the right-panel element!");
            return;
        }
        
        // Extract question from question-stem
        var questionStem = rightPanel.querySelector('.question-stem');
        if (!questionStem) {
            alert("Could not find the question-stem element!");
            return;
        }
        
        // Get the innerHTML which contains the KaTeX math expressions
        var questionHTML = questionStem.innerHTML;
        
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
        var formattedAnswers = answerChoices.map(function(choice, index) {
            var letter = String.fromCharCode(65 + index); // A, B, C, D, E
            return letter + ". " + choice;
        }).join("\n");
        
        // Create popup window
        var popup = window.open("", "Extracted Quant Data", "width=800,height=700,scrollbars=yes");
        
        // Write the HTML content to the popup
        popup.document.write(
            '<html>' +
            '<head>' +
                '<title>Extracted Quant Data</title>' +
                '<style>' +
                    'body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }' +
                    'h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; }' +
                    'pre { background: #f4f4f4; padding: 15px; border-left: 4px solid #333; white-space: pre-wrap; word-wrap: break-word; }' +
                    '.section { margin-bottom: 30px; }' +
                    'button { padding: 10px 15px; margin: 5px; background-color: #2196F3; color: white; border: none; cursor: pointer; }' +
                    'button:hover { background-color: #0b7dda; }' +
                    '.math-display { text-align: center; margin: 1em 0; }' +
                '</style>' +
                '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>' +
                '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">' +
            '</head>' +
            '<body>' +
                '<button id="bookmarklet-copy" style="margin-top:20px;padding:8px 15px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;">Copy to Clipboard</button>' +
                '<div class="section">' +
                    '<h2>Question</h2>' +
                    '<div id="question">' + questionHTML + '</div>' +
                '</div>' +
                '<div class="section">' +
                    '<h2>Answer Choices</h2>' +
                    '<pre id="answers">' + formattedAnswers + '</pre>' +
                '</div>' +
                '<script>' +
                    '// Render KaTeX after everything is loaded' +
                    'window.addEventListener("load", function() {' +
                        'setTimeout(function() {' +
                            'var questionDiv = document.getElementById("question");' +
                            'renderMathInElement(questionDiv, {' +
                                'delimiters: [' +
                                    '{left: "$$", right: "$$", display: true},' +
                                    '{left: "$", right: "$", display: false}' +
                                ']' +
                            '});' +
                        '}, 500);' +
                    '});' +
                '</script>' +
            '</body>' +
            '</html>'
        );
        
        // Close the document writing
        popup.document.close();
        
        // Attach the copy button event listener after the document is loaded
        popup.addEventListener('load', function() {
            popup.document.getElementById("bookmarklet-copy").addEventListener("click", function() {
                var questionDiv = popup.document.getElementById("question");
                var answersPre = popup.document.getElementById("answers");
                
                // Get the question text content
                var questionText = questionDiv.innerHTML;
                
                // Convert KaTeX to standard math format
                var tempDiv = popup.document.createElement("div");
                tempDiv.innerHTML = questionText;
                
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
                            var mathPlaceholder = popup.document.createTextNode(isDisplay ? "$$" + texContent + "$$" : "$" + texContent + "$");
                            katexElem.replaceWith(mathPlaceholder);
                        }
                    }
                });
                
                var clipboardContent = tempDiv.textContent + "\n\n" + answersPre.textContent;
                
                // Copy to clipboard
                popup.navigator.clipboard.writeText(clipboardContent).then(function() {
                    var btn = popup.document.getElementById("bookmarklet-copy");
                    var originalText = btn.innerText;
                    btn.innerText = "Copied!";
                    btn.style.background = "#8BC34A";
                    setTimeout(function() {
                        btn.innerText = originalText;
                        btn.style.background = "#4CAF50";
                    }, 2000);
                }).catch(function(err) {
                    alert("Copy failed: " + err);
                });
            });
        });
        
    } catch (error) {
        alert("Error occurred: " + (error.message || error));
    }
})();