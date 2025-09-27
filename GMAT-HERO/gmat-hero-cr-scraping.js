javascript: (function() {
    try {
        // Find the main content container
        var testContent = document.getElementById('test-content');
        if (!testContent) {
            alert("Could not find the test-content element!");
            return;
        }
        
        // Find the right panel
        var rightPanel = testContent.querySelector('#right-panel');
        if (!rightPanel) {
            alert("Could not find the right-panel element!");
            return;
        }
        
        // Extract passage and question from question-stem
        var questionStem = rightPanel.querySelector('.question-stem');
        if (!questionStem) {
            alert("Could not find the question-stem element!");
            return;
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
        }).join("\n");
        
        // Create popup window
        var popup = window.open("", "Extracted Data", "width=800,height=700,scrollbars=yes");
        popup.document.write(
            '<html>' +
            '<head>' +
                '<title>Extracted Data</title>' +
                '<style>' +
                    'body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }' +
                    'h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; }' +
                    'pre { background: #f4f4f4; padding: 15px; border-left: 4px solid #333; white-space: pre-wrap; word-wrap: break-word; }' +
                    '.section { margin-bottom: 30px; }' +
                    'button { padding: 10px 15px; margin: 5px; background-color: #2196F3; color: white; border: none; cursor: pointer; }' +
                    'button:hover { background-color: #0b7dda; }' +
                '</style>' +
            '</head>' +
            '<body>' +
                '<button onclick="copyToClipboard()">Copy to Clipboard</button>' +
                '<div class="section">' +
                    '<h2>Passage</h2>' +
                    '<pre id="passage">' + passage + '</pre>' +
                '</div>' +
                '<div class="section">' +
                    '<h2>Question</h2>' +
                    '<pre id="question">' + question + '</pre>' +
                '</div>' +
                '<div class="section">' +
                    '<h2>Answer Choices</h2>' +
                    '<pre id="answers">' + formattedAnswers + '</pre>' +
                '</div>' +
                '<script>' +
                    'function copyToClipboard() {' +
                        'var passage = document.getElementById("passage").textContent;' +
                        'var question = document.getElementById("question").textContent;' +
                        'var answers = document.getElementById("answers").textContent;' +
                        'var content = passage + "\\n\\n" + question + "\\n\\n" + answers;' +
                        'navigator.clipboard.writeText(content).then(function() {' +
                            'showToast("Content copied to clipboard");' +
                        '}).catch(function(err) {' +
                            'console.error("Failed to copy: ", err);' +
                            'showToast("Failed to copy content to clipboard");' +
                        '});' +
                    '}' +
                    'function showToast(message) {' +
                        'var toast = document.createElement("div");' +
                        'toast.textContent = message;' +
                        'toast.style.cssText = "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); " +' +
                            '"background-color: #333; color: white; padding: 16px; border-radius: 4px; " +' +
                            '"z-index: 1000; font-family: Arial, sans-serif; font-size: 16px; " +' +
                            '"box-shadow: 0 2px 8px rgba(0,0,0,0.2); opacity: 0; transition: opacity 0.3s;";' +
                        'document.body.appendChild(toast);' +
                        'setTimeout(function() {' +
                            'toast.style.opacity = "1";' +
                        '}, 100);' +
                        'setTimeout(function() {' +
                            'toast.style.opacity = "0";' +
                            'setTimeout(function() {' +
                                'document.body.removeChild(toast);' +
                            '}, 300);' +
                        '}, 3000);' +
                    '}' +
                '</script>' +
            '</body>' +
            '</html>'
        );
        
    } catch (error) {
        alert("Error occurred: " + (error.message || error));
    }
})();