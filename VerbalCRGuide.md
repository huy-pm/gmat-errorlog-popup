# GMAT Verbal Critical Reasoning Scraper Guide

## Overview
This document provides a comprehensive guide to the `gmatclub-verbal-scraping.js` bookmarklet, which extracts and formats GMAT Critical Reasoning questions from GMAT Club forum posts. The tool is designed to parse HTML content, identify question components, and present them in a clean, standardized format.

## Features

### 1. Content Extraction
- Extracts passage content from GMAT Club forum posts
- Identifies and separates the question stem
- Parses answer choices in multiple formats
- Removes extraneous elements (signatures, spoilers, etc.)

### 2. Answer Choice Format Support
The scraper supports a wide variety of answer choice formats commonly found on GMAT Club:

| Format | Example | Normalized Output |
|--------|---------|-------------------|
| Parentheses | `(A) Choice text` | `A. Choice text` |
| Period | `A. Choice text` | `A. Choice text` |
| Parenthesis | `A) Choice text` | `A. Choice text` |
| Colon | `A: Choice text` | `A. Choice text` |
| Semicolon | `A; Choice text` | `A. Choice text` |
| Slash | `A/ Choice text` | `A. Choice text` |
| Space | `A Choice text` | `A. Choice text` |
| HTML Entities | `&lt;A&gt; Choice text` | `A. Choice text` |

### 3. Output Formatting
- Standardizes all answer choices to `A. Choice text` format
- Removes extra spacing between letters and content
- Cleans HTML entities and tags
- Preserves line breaks and formatting where appropriate

### 4. User Interface
- Creates a popup window with organized sections:
  - Passage
  - Question
  - Answer Choices
- Copy to clipboard functionality with toast notification
- Responsive design for various screen sizes

## Technical Implementation

### 1. DOM Selection
The script follows a specific DOM traversal path:
```
.post-wrapper.first-post 
  └── .post-info.add-bookmark 
        └── .item.text (primary content)
```

### 2. Content Processing Logic

#### A. Element Cleanup
1. Clones the primary content element
2. Removes `.item.twoRowsBlock` and `.post_signature` elements
3. Converts HTML to a flat string and removes line breaks

#### B. Answer Section Detection
Uses multiple regex patterns to identify where answer choices begin:
```javascript
var answerPatterns = [
    "<br><br>\\(",        // For (A) format
    "<br><br>[A-Za-z][.:;)/]", // For A., A), A:, A;, A/, A) formats
    "<br><br>[A-Za-z]\\s",     // For A followed by space
    "<br><br>&lt;[A-Za-z]&gt;" // For <A> format
];
```

#### C. Answer Choice Parsing
1. Splits content at the first answer pattern match
2. Further splits answer section by `<br>` tags
3. Filters lines using comprehensive regex:
```javascript
/^\([A-Za-z]\)|^[A-Za-z][.:;)/]?|^([A-Za-z])\s+|^&lt;[A-Za-z]&gt;/
```

#### D. Answer Choice Normalization
Converts all formats to standard `A. Choice text`:
```javascript
.replace(/^\(([A-Za-z])\)/, '$1.')     // (A) → A.
.replace(/^([A-Za-z])[:;)/]/, '$1.')   // A), A:, A;, A/ → A.
.replace(/^&lt;([A-Za-z])&gt;/, '$1.')  // <A> → A.
.replace(/^([A-Za-z])\.\s+/, '$1. ')   // Extra spaces → single space
```

#### E. Question Identification
1. Splits passage content by `<br>` tags
2. Searches from bottom up for lines containing "?"
3. Prioritizes lines with question words (which, what, how, why)
4. Treats everything before question as passage

#### F. Content Cleanup
- Removes HTML tags
- Converts common HTML entities (`&ldquo;`, `&rdquo;`, `&amp;`)
- Trims whitespace
- Preserves meaningful line breaks

### 3. Popup Interface
The popup window includes:
- Three organized sections (Passage, Question, Answer Choices)
- "Copy to Clipboard" button with toast notification
- Clean, readable styling with proper spacing

### 4. Error Handling
- Validates presence of required DOM elements
- Provides specific error messages for missing elements
- Uses try/catch blocks for general error handling

## Usage

### Installation
1. Create a bookmark in your browser
2. Set the URL to the complete JavaScript code
3. Navigate to a GMAT Club CR question page
4. Click the bookmark to run the scraper

### Operation
1. Click the bookmarklet on any GMAT Club CR question page
2. A popup window will appear with the parsed content
3. Use the "Copy to Clipboard" button to copy the formatted content
4. Paste into your preferred study tool or document

## Supported Question Types
- Critical Reasoning questions
- Reading Comprehension questions (limited support)
- Sentence Correction questions (limited support)

## Limitations
- Requires specific DOM structure (`.post-wrapper.first-post`)
- May not work with significantly different page layouts
- Does not process images or complex formatting
- Limited support for non-CR question types

## Maintenance
When updating the script, ensure:
1. Regex patterns are updated for new answer formats
2. DOM selectors match current GMAT Club structure
3. Error handling remains comprehensive
4. Output formatting stays consistent
5. Test with various question formats

## Testing
The `final-test-all-cases.html` file provides test cases for:
- All supported answer formats
- Various question structures
- Edge cases in content parsing
- UI functionality verification