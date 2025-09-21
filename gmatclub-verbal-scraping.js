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
        
        // Look for answer choices pattern (A. B. C. D. E.)
        var answerMatch = h.search(/[A-E]\.\s/);
        
        if (answerMatch === -1) {
            alert("No answer choices found (A. B. C. D. E. pattern).");
            return;
        }
        
        // Split content before answer choices
        var beforeAnswers = h.substring(0, answerMatch);
        var answersSection = h.substring(answerMatch);
        
        // Find the question - look for the last sentence ending with "?" before answer choices
        var questionMatches = beforeAnswers.match(/([^<]*\?)\s*(?:<br\s*\/?>)*/gi);
        
        var passage, question;
        
        if (questionMatches && questionMatches.length > 0) {
            // Get the last question match
            var lastQuestion = questionMatches[questionMatches.length - 1];
            var questionIndex = beforeAnswers.lastIndexOf(lastQuestion);
            
            // Everything before the question is passage
            passage = beforeAnswers.substring(0, questionIndex);
            question = lastQuestion;
        } else {
            // Fallback: if no question found, treat everything as passage
            passage = beforeAnswers;
            question = "";
        }
        
        // Clean up passage - remove HTML tags and normalize
        passage = passage
            .replace(/<br\s*\/?>/gi, '\n')          // Convert <br> to newlines
            .replace(/<[^>]*>/g, '')                 // Remove HTML tags (fixed regex)
            .replace(/&ldquo;/g, '"')                // Convert HTML entities
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
            .trim();
        
        // Clean up question
        question = question
            .replace(/<br\s*\/?>/gi, ' ')            // Convert <br> to spaces in question
            .replace(/<[^>]*>/g, '')                 // Remove HTML tags (fixed regex)
            .replace(/&ldquo;/g, '"')                // Convert HTML entities
            .replace(/&rdquo;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, '')        // Remove any remaining HTML entities
            .trim();
        
        // Extract answer choices
        var answerChoices = answersSection
            .replace(/<br\s*\/?>/gi, '\n')
            .split('\n')
            .map(function(line) {
                return line.replace(/<[^>]*>/g, '').trim();
            })
            .filter(function(line) {
                return /^[A-E]\./.test(line);
            });
        
        var answers = answerChoices.join('\n');
        
        // Create popup window
        var popup = window.open("", "Extracted Data", "width=700,height=600,scrollbars=yes");
        popup.document.write(
            '<html>' +
            '<head>' +
                '<title>Extracted Data</title>' +
                '<style>' +
                    'body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }' +
                    'h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; }' +
                    'pre { background: #f4f4f4; padding: 15px; border-left: 4px solid #333; white-space: pre-wrap; word-wrap: break-word; }' +
                    '.section { margin-bottom: 30px; }' +
                '</style>' +
            '</head>' +
            '<body>' +
                '<div class="section">' +
                    '<h2>Passage</h2>' +
                    '<pre>' + passage + '</pre>' +
                '</div>' +
                '<div class="section">' +
                    '<h2>Question</h2>' +
                    '<pre>' + question + '</pre>' +
                '</div>' +
                '<div class="section">' +
                    '<h2>Answer Choices</h2>' +
                    '<pre>' + answers + '</pre>' +
                '</div>' +
            '</body>' +
            '</html>'
        );
        
    } catch (s) {
        alert("Error occurred: " + (s.message || s));
    }
})();
