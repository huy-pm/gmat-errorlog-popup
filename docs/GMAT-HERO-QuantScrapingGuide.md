# GMAT Quant Question Scraping Guide

This guide explains how to use the GMAT Quant Question Extractor bookmarklet.

## Overview

The GMAT Quant Question Extractor is a bookmarklet that extracts quantitative questions and their answer choices from web pages that follow a specific structure. It's particularly useful for extracting questions that use KaTeX for mathematical expressions.

## Files in This Repository

- `gmat-hero/gmat-hero-quant-scraping.js` - The main bookmarklet script
- `gmat-hero/quant-test-bookmarklet.html` - A test page to try the bookmarklet
- `gmat-hero/quant-sample.html` - Sample GMAT quant question structure
- `gmat-hero/clipboard-test.html` - Test page for clipboard functionality
- `gmat-hero/copy-test.html` - Simple test for copy functionality
- `gmat-hero/README-QUANT-SCRAPING.md` - Detailed instructions for the quant scraper

## Installation

1. Navigate to `gmat-hero/gmat-hero-quant-scraping.js`
2. Copy the entire content of the file (it starts with `javascript:(function()`)
3. In your browser, create a new bookmark:
   - Right-click on your bookmarks bar and select "Add page..." (Chrome) or "Add Bookmark..." (Firefox)
   - Name it "GMAT Quant Extractor"
   - Paste the copied content into the URL field
4. Save the bookmark

## Usage

1. Navigate to a webpage containing a GMAT quant question with the expected structure
2. Click the "GMAT Quant Extractor" bookmarklet
3. A popup window will appear with:
   - The extracted question
   - The 5 answer choices
   - A "Copy to Clipboard" button

## Expected HTML Structure

The bookmarklet works with pages that have this structure:

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
    <div class="option ng-star-inserted">
      <label>
        <span>Answer choice B</span>
      </label>
    </div>
    <!-- ... and so on for C, D, E -->
  </div>
</div>
```

## Features

- Extracts questions with KaTeX mathematical expressions
- Preserves mathematical notation by including KaTeX rendering in the popup
- Formats answer choices as A., B., C., D., E.
- Provides one-click copying to clipboard with math-friendly formatting
- Responsive popup design
- Robust copy-to-clipboard implementation with fallback for older browsers

## Clipboard Format

The key improvement in this version is how the content is formatted when copied to clipboard:

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

This format can be directly used with KaTeX or MathJax libraries for rendering in other applications.

## Testing

To test the bookmarklet:

1. Open `gmat-hero/quant-test-bookmarklet.html` in your browser
2. Click your "GMAT Quant Extractor" bookmarklet
3. Verify that the popup appears with the correct content
4. Click "Copy to Clipboard" and paste the content in `gmat-hero/clipboard-test.html` to see how it renders
5. Try `gmat-hero/copy-test.html` to verify that the copy functionality works in your browser

## Troubleshooting

If the bookmarklet doesn't work:

1. Make sure you're on a page with the correct structure
2. Check that the page has loaded completely
3. Verify that your bookmarklet was created correctly
4. Check the browser's developer console for any error messages

## Copy Implementation Details

The copy functionality now uses a robust approach with fallbacks:

1. First tries to use the modern `navigator.clipboard.writeText()` API (requires HTTPS or localhost)
2. Falls back to the older `document.execCommand("copy")` method for older browsers or insecure contexts
3. Provides user feedback via toast notifications

This approach should work across all modern browsers and contexts.

## Customization

You can modify the bookmarklet by editing `gmat-hero/gmat-hero-quant-scraping.js`:

- To change the popup styling, modify the CSS in the `<style>` section
- To change the popup dimensions, modify the `window.open` parameters
- To modify how content is copied to clipboard, edit the `copyToClipboard` function