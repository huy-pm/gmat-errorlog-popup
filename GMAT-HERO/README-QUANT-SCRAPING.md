# GMAT Quant Question Extractor

This bookmarklet extracts GMAT quantitative questions and their answer choices from web pages with a specific structure.

## Files

- `gmat-hero-quant-scraping.js` - The bookmarklet script
- `quant-test-bookmarklet.html` - Test HTML page
- `quant-sample.html` - Sample GMAT quant question structure
- `clipboard-test.html` - Test page for clipboard functionality
- `copy-test.html` - Simple test for copy functionality
- `final-copy-test.html` - Final test for copy functionality
- `debug-popup.html` - Debug popup functionality
- `test-copy-fix.html` - Test copy fix approach
- `test-structure.html` - Test HTML structure
- `math-renderer.html` - Full-featured math renderer for clipboard content
- `simple-math-renderer.html` - Simple math renderer for clipboard content
- `bookmarklet-output-example.html` - Example of bookmarklet output format
- `debug-renderer.html` - Debug renderer for testing parsing
- `test-your-question.html` - Test file for your specific question
- `verify-parsing.html` - Verify parsing logic

## How to Use

1. Open `gmat-hero-quant-scraping.js` and copy its entire content
2. Create a new bookmark in your browser
3. Paste the copied content as the URL of the bookmark
4. Name the bookmark something like "GMAT Quant Extractor"
5. Navigate to a page with a GMAT quant question that matches the expected structure
6. Click the bookmark to extract the question and answer choices

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

- Extracts questions that use KaTeX for mathematical expressions
- Extracts all 5 answer choices
- Displays content in a popup window with copy-to-clipboard functionality
- Renders mathematical expressions using KaTeX in the popup
- **Clipboard content formatted for KaTeX/MathJax rendering**
- **Simplified and robust copy-to-clipboard implementation**

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