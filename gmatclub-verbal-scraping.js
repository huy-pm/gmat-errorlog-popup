javascript: (function() {
    try {
        var e = document.querySelector('.post-wrapper.first-post');
        if (!e) {
            alert("Could not find the first post wrapper!");
            return;
        }
        
        var t = e.querySelector('.post-info.add-bookmark');
        if (!t) {
            alert("Could not find the post-info add-bookmark section!");
            return;
        }
        
        var n = t.querySelector('.item.text');
        if (!n) {
            alert("Could not find the item text div!");
            return;
        }
        
        var o = n.cloneNode(true);
        o.querySelectorAll('.item.twoRowsBlock,.post_signature').forEach(function(e) {
            e.remove();
        });
        
        var h = o.innerHTML.replace(/\r?\n|\r/g, "");
        
        // Find where answer choices begin - look for multiple patterns
        var answerSectionStart = h.indexOf("<br><br>(");
        
        // Also check for <br><br>A. pattern (as seen in test cases)
        if (answerSectionStart === -1) {
            answerSectionStart = h.indexOf("<br><br>A.");
        }
        
        // Also check for <br><br>A: pattern (as seen in test cases)
        if (answerSectionStart === -1) {
            answerSectionStart = h.indexOf("<br><br>A:");
        }
        
        var questionHTML = '';
        var answersHTML = '';
        
        if (answerSectionStart !== -1) {
            // Split content at the answer choices
            questionHTML = h.substring(0, answerSectionStart).trim();
            var answersPart = h.substring(answerSectionStart).trim();
            
            // Extract answer choices by splitting on <br> and filtering
            var answerLines = answersPart.split("<br>");
            var answerChoices = [];
            
            for (var i = 0; i < answerLines.length; i++) {
                var line = answerLines[i].trim();
                // Check for answer patterns: (A), A., A:, or just A followed by space/content
                if (line.length > 0 && (/^\([A-E]\)|^[A-E][.:]|^[A-E]\s/.test(line))) {
                    answerChoices.push(line);
                }
            }
            
            // Format answers for display - ALWAYS in format "A. [Answer choice]"
            answersHTML = answerChoices.map(function(choice) {
                // Convert (A) format to A. format
                // Also handle A: format
                return choice.replace(/^\(([A-E])\)/, '$1.').replace(/^([A-E]):/, '$1.') + "";
            }).join("<br>");
        } else {
            // Fallback: if we can't find answer choices, treat everything as question
            questionHTML = h;
            answersHTML = "No answer choices found";
        }
        
        // Extract passage and question
        var passage = "";
        var question = "";
        
        // Robust approach: Split by <br> and intelligently identify the question
        var parts = questionHTML.split("<br>");
        var questionIndex = -1;
        
        // Look for the question part - it's typically the last meaningful part with a question mark
        // or contains key question words
        for (var i = parts.length - 1; i >= 0; i--) {
            var part = parts[i].trim();
            // Skip empty parts
            if (part.length === 0) continue;
            
            // Look for question patterns
            if ((part.includes("?") && (part.toLowerCase().includes("which") || 
                                       part.toLowerCase().includes("what") || 
                                       part.toLowerCase().includes("how") || 
                                       part.toLowerCase().includes("why") || 
                                       part.toLowerCase().includes("except:")))) {
                questionIndex = i;
                question = part;
                break;
            }
        }
        
        // Fallback: if we didn't find a specific pattern, look for any text ending with ?
        if (questionIndex === -1) {
            for (var i = parts.length - 1; i >= 0; i--) {
                var part = parts[i].trim();
                if (part.length > 0 && part.includes("?")) {
                    questionIndex = i;
                    question = part;
                    break;
                }
            }
        }
        
        if (questionIndex >= 0) {
            // Build passage from parts before the question
            var passageParts = parts.slice(0, questionIndex);
            passage = passageParts.join(" ").trim();
        } else {
            // If no question found, treat everything as passage
            passage = questionHTML;
        }
        
        // Clean up passage - remove HTML tags and normalize
        passage = passage
            .replace(/<br\s*\/?>/gi, '\n')          // Convert <br> to newlines
            .replace(/<[^>]*>/g, '')                 // Remove HTML tags
            .replace(/&ldquo;/g, '"')                // Convert HTML entities
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
            .trim();
        
        // Clean up question
        question = question
            .replace(/<br\s*\/?>/gi, ' ')            // Convert <br> to spaces
            .replace(/<[^>]*>/g, '')                 // Remove HTML tags
            .replace(/&ldquo;/g, '"')                // Convert HTML entities
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
            .trim();
        
        // Clean up answers
        var cleanAnswers = answersHTML
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')
            .trim();
        
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
                    '<pre id="answers">' + cleanAnswers + '</pre>' +
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
        
    } catch (s) {
        alert("Error occurred: " + (s.message || s));
    }
})();