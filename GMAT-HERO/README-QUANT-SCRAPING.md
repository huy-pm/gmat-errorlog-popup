# GMAT Quant Question Extractor

This bookmarklet extracts GMAT quantitative questions and their answer choices from web pages with a specific structure.

## Files

- `gmat-hero-quant-scraping.js` - The bookmarklet script
- `gmat-hero-quant-auto-scraping.js` - Automated version that extracts multiple questions
- `math-renderer.html` - Full-featured math renderer for clipboard content

## How to Use

### Manual Extraction (`gmat-hero-quant-scraping.js`)
1. Open `gmat-hero-quant-scraping.js` and copy its entire content
2. Create a new bookmark in your browser
3. Paste the copied content as the URL of the bookmark
4. Name the bookmark something like "GMAT Quant Extractor"
5. Navigate to a page with a GMAT quant question that matches the expected structure
6. Click the bookmark to extract the question and answer choices

### Automated Extraction (`gmat-hero-quant-auto-scraping.js`)
1. Open `gmat-hero-quant-auto-scraping.js` and copy its entire content
2. Create a new bookmark in your browser
3. Paste the copied content as the URL of the bookmark
4. Name the bookmark something like "GMAT Quant Auto Extractor"
5. Navigate to the first question in a series of GMAT quant questions
6. Click the bookmark to open the automation control panel
7. Click "Start" to begin the automated extraction process
8. The script will automatically extract questions and navigate to the next one
9. Click "Stop" at any time to halt the process and save all extracted questions

## Expected Structure

The bookmarklet looks for this specific structure:

```html
<div id="right-panel">
  <div class="question-stem">
    <!-- Question content with KaTeX math expressions -->
  </div>
  <div class="standard-choices ng-star-inserted">
    <div class="option ng-star-inserted">
      <label>
        <span>Answer choice A</span>
      </label>
    </div>
    <!-- ... more options ... -->
  </div>
</div>
```

## Features

### Manual Extraction
- Extracts questions that use KaTeX for mathematical expressions
- Extracts all 5 answer choices
- Displays content in a popup window with copy-to-clipboard functionality
- Renders mathematical expressions using KaTeX in the popup
- **Clipboard content formatted for KaTeX/MathJax rendering**
- **Simplified and robust copy-to-clipboard implementation**

### Automated Extraction
- **Automated Extraction Process:**
  - Click "Start" to begin the automated extraction
  - The script will automatically extract the current question and click "Next"
  - Waits 2 seconds between each extraction to allow the page to load
  - Continues until there are no more questions
- **Real-time Status Updates:**
  - Shows the current status (Ready, Running, Stopped)
  - Displays the count of questions extracted in real-time
- **Stop and Save Functionality:**
  - Click "Stop" at any time to halt the process
  - Automatically saves all extracted questions to a JSON file named gmat-quant-{timestamp}.json
- **User-Friendly Interface:**
  - Clear instructions for use
  - Visual feedback through color-coded status indicators
  - Responsive button states (enabled/disabled as appropriate)
- **Proper Question Formatting:**
  - Processes KaTeX mathematical expressions in questions to extract clean LaTeX notation
  - Maintains the same formatting logic as the manual extraction script

## Clipboard Format

When you click "Copy to Clipboard", the content is formatted to preserve mathematical notation:

- Mathematical expressions are converted to standard KaTeX format using `$` for inline math and `$$` for display math
- Question text and answer choices are separated by blank lines
- Answer choices are formatted as "A. [choice]", "B. [choice]", etc.

Example clipboard content:
```
n is the product of the first 5 prime numbers. If $\dfrac{12!}{n}$ is divisible by $2^k$, what is the greatest value of a positive integer $k$?

A. 6
B. 7
C. 8
D. 9
E. 10
```

This format can be directly used with KaTeX or MathJax libraries for rendering.

## JSON Output Format

The automated extraction script saves questions in the following JSON format:

```
{
  "totalRecords": 25,
  "questions": [
    {
      "question": "For any positive integer $n$, $n>1$, the \"length\" of $n$ is the number of positive primes (not necessarily distinct) whose product is $n$. For ex, the length of $50$ is $3$, since $50=2\\times 5 \\times 5$. Which of the following integers has length $3$?",
      "answers": [
        "A. 3",
        "B. 15",
        "C. 60",
        "D. 64",
        "E. 105"
      ],
      "link": "https://gmat-hero.com/question/12345"
    }
  ]
}
```

Note that mathematical expressions in questions are now properly converted from KaTeX HTML to LaTeX format (e.g., `$n$`, `$n>1$`, `$50$`, `$3$`, `$50=2\\times 5 \\times 5$`).

## Rendering Your Saved Questions

After extracting questions with the bookmarklet, you can view them with proper mathematical formatting using the renderer pages:

1. **`math-renderer.html`** - Full-featured renderer with question/answer parsing
2. **`simple-math-renderer.html`** - Simple renderer that just processes math expressions
3. **`bookmarklet-output-example.html`** - Shows example of what the bookmarklet copies
4. **`test-your-question.html`** - Test file specifically for your question format
5. **`verify-parsing.html`** - Debug tool to verify parsing logic

To use any of these renderers:
1. Copy a question using the bookmarklet
2. Open the renderer HTML file in your browser
3. Paste the content into the text area
4. Click "Render" to see the properly formatted question

### JSON File Upload Feature

The `math-renderer.html` file now supports uploading JSON files containing multiple questions:

1. Click the "Choose File" button to select a JSON file
2. Click "Load Questions from JSON" to load and display all questions
3. Questions will be displayed in a collapsible list format
4. Click on any question header to expand/collapse its content
5. Mathematical expressions are automatically rendered using MathJax/KaTeX

Alternatively, you can simply select a file and it will automatically show a message prompting you to click the load button.

The JSON file should follow the format generated by the automated extraction script:
```json
{
  "totalRecords": 25,
  "questions": [
    {
      "question": "For any positive integer $n$, $n>1$, the \"length\" of $n$ is the number of positive primes (not necessarily distinct) whose product is $n$. For ex, the length of $50$ is $3$, since $50=2\\times 5 \\times 5$. Which of the following integers has length $3$?",
      "answers": [
        "A. 3",
        "B. 15",
        "C. 60",
        "D. 64",
        "E. 105"
      ],
      "link": "https://gmat-hero.com/question/12345"
    }
  ]
}
```

## Testing

1. Open `quant-test-bookmarklet.html` in your browser and use the bookmarklet to test the functionality
2. Open `clipboard-test.html` to see the expected clipboard format and test how it renders with KaTeX
3. Open `copy-test.html` to verify that the basic copy functionality works in your browser
4. Open `final-copy-test.html` to test the complete workflow
5. Open `test-copy-fix.html` to test the fixed copy approach
6. Open `test-structure.html` to test with the actual HTML structure
7. Open `math-renderer.html` to test rendering clipboard content
8. Open `simple-math-renderer.html` for simple math rendering
9. Open `bookmarklet-output-example.html` to see bookmarklet output format
10. Open `debug-renderer.html` to debug parsing issues
11. Open `test-your-question.html` to test your specific question format
12. Open `verify-parsing.html` to verify the parsing logic
13. Open `test-parsing-fix.html` to test the parsing fix for complex mathematical expressions
14. Open `test-specific-case.html` to test the specific problematic case
15. Open `verify-parsing-fix.html` to verify parsing improvements
16. Open `gmat-hero-test-structure.html` to test with the GMAT Hero structure
17. Open `test-auto-scraping-fix.html` to test the auto scraping fix

## How It Works

The bookmarklet:

1. Finds the question content within the `.question-stem` div
2. Extracts KaTeX mathematical expressions and converts them to standard math format
3. Finds all 5 answer choices from the `.standard-choices` div
4. Displays the content in a popup window with KaTeX rendering
5. When copying to clipboard, formats the content for later KaTeX/MathJax rendering

## Copy Implementation

The copy functionality now uses a fixed approach:

1. Creates the popup window with `window.open()`
2. Writes the HTML content with `document.write()`
3. Closes the document with `document.close()`
4. Attaches the event listener using `popup.addEventListener('load')` after the popup is fully loaded
5. Uses `popup.navigator.clipboard.writeText()` to copy content
6. Provides visual feedback when content is copied

This approach ensures that the event listener is attached at the right time, after the DOM elements are available in the popup.

## Parsing Improvements

The latest version includes improved parsing logic for answer choices:

1. Multiple selector strategies to find answer options
2. Fallback methods for different HTML structures
3. Better text extraction from various DOM elements
4. Enhanced cleaning of answer text to remove formatting artifacts
5. Improved handling of complex mathematical expressions in answer choices
6. Special handling for Katex math expressions in answer choices

These improvements ensure that answer choices with complex mathematical notation are properly extracted and formatted, including the specific case with expressions like:
- $\sqrt{2-x}$
- $2x-6 + \sqrt{2-x}$
- $\sqrt{2-x} + x-3$
- $2x-6 + \sqrt{x-2}$
- $x + \sqrt{x-2}$

## Recent Fixes

### Fix for Complex Mathematical Answer Choices (v1.2)
- Resolved issue where answer choices with complex Katex mathematical expressions were not being parsed correctly
- Added special handling for Katex elements within answer choice labels
- Improved extraction of mathematical notation from answer choices
- Verified fix with the specific case that was causing issues

### Fix for Question Formatting in Auto-Scraping (v1.3)
- Resolved issue where questions were being extracted as raw HTML with Katex elements instead of clean text with LaTeX notation
- Applied the same processing logic used in the manual extraction script to convert Katex HTML to LaTeX format
- Questions now properly display mathematical expressions as `$n$`, `$n>1$`, etc. instead of raw HTML
- Maintains consistency between manual and automated extraction formats

The fix ensures that when the bookmarklet encounters answer choices with Katex mathematical expressions, it properly extracts the underlying LaTeX notation and formats it correctly for clipboard output.