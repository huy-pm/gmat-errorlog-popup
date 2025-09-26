javascript:(function() {
  function extractRCContent() {
    try {
      // Find the main item container
      let container = document.querySelector('.item.text');
      if (!container) {
        alert('No question container found.');
        return;
      }
      
      let clone = container.cloneNode(true);
      
      // Remove unwanted blocks
      clone.querySelectorAll('.twoRowsBlock, .post_signature, .spoiler').forEach(el => el.remove());
      
      // Convert the clone to HTML string for easier manipulation
      let htmlContent = clone.innerHTML;
      
      // Find bbcodeBoxOut element
      let bbcodeBoxOut = clone.querySelector('.bbcodeBoxOut');
      if (!bbcodeBoxOut) {
        alert('No bbcodeBoxOut found.');
        return;
      }
      
      // Step 1: Locate the passage content
      // Find the first bbcodeBoxIn within bbcodeBoxOut
      let bbcodeBoxIns = bbcodeBoxOut.querySelectorAll('.bbcodeBoxIn');
      if (bbcodeBoxIns.length < 1) {
        alert('No bbcodeBoxIn elements found.');
        return;
      }
      
      let passageBox = bbcodeBoxIns[0];
      let passageHTML = passageBox.innerHTML;
      
      // Process passage content
      // Convert <br> tags to newlines
      passageHTML = passageHTML.replace(/<br\s*\/?>/gi, '\n');
      
      // Find <span> tags and enclose their content with ** markers
      passageHTML = passageHTML.replace(/<span[^>]*>(.*?)<\/span>/gi, '**$1**');
      
      // Clean up other HTML tags but preserve the marked content
      let passageText = passageHTML.replace(/<[^>]*>/g, '');
      
      // Step 2: Locate and extract questions and answers
      let questions = [];
      
      if (bbcodeBoxIns.length >= 2) {
        let questionsBox = bbcodeBoxIns[1];
        let questionWrappers = questionsBox.querySelectorAll('.question_wrapper');
        
        questionWrappers.forEach((wrapper, index) => {
          try {
            // Clone the wrapper to avoid modifying the original
            let wrapperClone = wrapper.cloneNode(true);
            
            // Find question text in <span> tags with style="font-weight: bold"
            let questionSpan = wrapperClone.querySelector('span[style*="font-weight: bold"]');
            let questionText = '';
            
            if (questionSpan) {
              questionText = questionSpan.textContent.trim();
              // Remove the question number prefix (e.g., "1. ")
              questionText = questionText.replace(/^\d+\.\s*/, '');
            } else {
              // Fallback: try to get text content
              questionText = wrapperClone.textContent.trim().split('\n')[0] || '';
              // Remove the question number prefix if present
              questionText = questionText.replace(/^\d+\.\s*/, '');
            }
            
            // Find answer choices by parsing the content after the question
            let choices = {};
            
            // Get the HTML content of the wrapper
            let wrapperHTML = wrapper.innerHTML;
            
            // Extract content after the question span
            let choicesHTML = '';
            if (questionSpan && questionSpan.outerHTML) {
              let spanEndIndex = wrapperHTML.indexOf(questionSpan.outerHTML) + questionSpan.outerHTML.length;
              choicesHTML = wrapperHTML.substring(spanEndIndex);
            } else {
              // Fallback to all content after removing the first span if it exists
              choicesHTML = wrapperHTML;
              if (questionSpan && questionSpan.outerHTML) {
                choicesHTML = choicesHTML.replace(questionSpan.outerHTML, '');
              }
            }
            
            // Parse answer choices from the HTML
            // Convert <br> tags to newlines for easier parsing
            choicesHTML = choicesHTML.replace(/<br\s*\/?>/gi, '\n');
            // Remove all other HTML tags
            let choicesText = choicesHTML.replace(/<[^>]*>/g, '');
            
            // Split by newlines and parse each line
            let lines = choicesText.split('\n');
            
            lines.forEach(line => {
              let cleanLine = line.trim();
              if (cleanLine) {
                // Check if this line starts with a letter and period/dot
                let choiceMatch = cleanLine.match(/^([A-Ea-e])[.)]\s*(.*)/);
                if (choiceMatch) {
                  let letter = choiceMatch[1].toUpperCase();
                  let text = choiceMatch[2].trim();
                  if (text) {
                    choices[letter] = text;
                  }
                }
              }
            });
            
            // Only add question if we have text
            if (questionText) {
              questions.push({
                question_text: questionText,
                choices: choices
              });
            }
          } catch (e) {
            console.error('Error processing question wrapper ' + index + ':', e);
          }
        });
      }
      
      // Step 3: Compile and format the final output
      let outputData = {
        passage: passageText,
        questions: questions
      };
      
      // Create overlay
      let overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '5%';
      overlay.style.left = '5%';
      overlay.style.width = '90%';
      overlay.style.height = '90%';
      overlay.style.background = 'white';
      overlay.style.color = 'black';
      overlay.style.overflow = 'auto';
      overlay.style.zIndex = 999999;
      overlay.style.padding = '20px';
      overlay.style.border = '2px solid black';
      overlay.style.borderRadius = '8px';
      overlay.style.boxShadow = '0 0 15px rgba(0,0,0,0.3)';
      overlay.style.fontFamily = 'Arial, sans-serif';
      
      // Format the output for display
      // Highlight text enclosed in ** with yellow background
      let formattedPassage = passageText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<span style="background-color: yellow;">$1</span>');
      let formattedQuestions = '';
      
      questions.forEach((q, index) => {
        formattedQuestions += `<h3>Question ${index + 1}</h3>`;
        formattedQuestions += `<p><strong>${q.question_text}</strong></p>`;
        for (let letter in q.choices) {
          formattedQuestions += `<div><strong>${letter}</strong> ${q.choices[letter]}</div>`;
        }
        formattedQuestions += '<br>';
      });
      
      overlay.innerHTML = `
        <h2 style="margin-bottom: 15px; color: #333;">Reading Comprehension Passage and Questions</h2>
        <div style="margin-bottom: 20px;">
          <h3>Passage</h3>
          <div style="padding: 15px; border-left: 4px solid #3498db; margin-bottom: 20px; line-height: 1.6;">
            ${formattedPassage}
          </div>
        </div>
        <div style="margin-bottom: 20px;">
          <h3>Questions</h3>
          <div style="line-height: 1.8;">
            ${formattedQuestions || 'No questions found.'}
          </div>
        </div>
        <button id="bookmarklet-copy" style="margin-top:20px;padding:10px 15px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Copy to Clipboard</button>
        <button id="bookmarklet-close" style="margin-top:20px;margin-left:10px;padding:10px 15px;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Close</button>
      `;
      
      document.body.appendChild(overlay);
      
      // Close button
      document.getElementById("bookmarklet-close").onclick = () => overlay.remove();
      
      // Copy button
      document.getElementById("bookmarklet-copy").onclick = () => {
        // Format data for copying
        let copyText = "Passage:\n" + passageText + "\n\nQuestions:\n";
        questions.forEach((q, index) => {
          copyText += `\n${index + 1}. ${q.question_text}\n`;
          for (let letter in q.choices) {
            copyText += `   ${letter} ${q.choices[letter]}\n`;
          }
        });
        
        navigator.clipboard.writeText(copyText).then(() => {
          let btn = document.getElementById("bookmarklet-copy");
          let originalText = btn.innerText;
          btn.innerText = "Copied!";
          btn.style.background = "#4CAF50";
          setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "#2196F3";
          }, 2000);
        }).catch(err => {
          alert("Copy failed: " + err);
        });
      };
      
    } catch (error) {
      alert("Error occurred: " + error.message);
    }
  }
  
  extractRCContent();
})();
