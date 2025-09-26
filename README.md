# gmat-errorlog-popup
Bookmarklet for gmat error log

## Features

This bookmarklet extracts GMAT verbal questions from GMAT Club and displays them in a clean popup window with the following features:

1. Extracts the passage, question, and answer choices
2. Cleans up formatting and removes unnecessary elements
3. Provides a "Copy to Clipboard" button to easily copy the content

## How to Use

1. Create a new bookmark in your browser
2. Edit the bookmark and paste the entire content of `gmatclub-verbal-scraping.js` as the URL/location
3. Save the bookmark
4. Navigate to a GMAT Club verbal question page
5. Click the bookmarklet
6. A popup window will appear with the extracted content and a "Copy to Clipboard" button

## Testing

To test the bookmarklet:
1. Open `final-test-all-cases.html` or `bookmarklet-test-with-clipboard.html` in your browser
2. Follow the instructions on the page to test the bookmarklet functionality

## Files

- `gmatclub-verbal-scraping.js` - Main bookmarklet script with copy to clipboard functionality
- `final-test-all-cases.html` - Comprehensive test suite with multiple question formats
- `bookmarklet-test-with-clipboard.html` - Simple test page for the bookmarklet
- `README-CLIPBOARD-FEATURE.md` - Detailed documentation of the clipboard feature