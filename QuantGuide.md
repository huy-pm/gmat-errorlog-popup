# GMAT Quantitative Scraper Guide

## Overview
This document provides a comprehensive guide to the `gmatclub-quant-scraping.js` bookmarklet, which extracts and formats GMAT Quantitative questions from GMAT Club forum posts. The tool is designed to parse HTML content, identify question components, and present them in a clean, standardized format with proper mathematical notation support.

## Features

### 1. Content Extraction
- Extracts mathematical questions from GMAT Club forum posts
- Identifies and separates question content from answer choices
- Removes extraneous elements (signatures, spoilers, etc.)
- Preserves mathematical notation using MathJax

### 2. Mathematical Notation Support
- Processes LaTeX mathematical expressions
- Supports both inline math (`$...$`) and display math (`$$...$$`)
- Converts MathJax script tags to proper LaTeX delimiters
- Renders mathematical notation using MathJax library

### 3. Answer Choice Format Support
The scraper supports various answer choice formats:

| Format | Example | Normalized Output |
|--------|---------|-------------------|
| Parentheses | `(A) Choice text` | `A. Choice text` |
| Period | `A. Choice text` | `A. Choice text` |
| Parenthesis | `A) Choice text` | `A. Choice text` |

### 4. Output Formatting
- Standardizes all answer choices to `A. Choice text` format
- Removes HTML tags while preserving content
- Maintains proper spacing and line breaks
- Integrates mathematical notation rendering

### 5. User Interface
- Creates an overlay window with organized sections:
  - Question content
  - Answer Choices
- Copy to clipboard functionality with visual feedback
- Close button to dismiss the overlay
- Responsive design that covers 84% of screen

## Technical Implementation

### 1. DOM Selection
The script follows this DOM traversal path:
```
.item.text (primary content container)
```

### 2. Content Processing Logic

#### A. Element Cleanup
1. Clones the primary content element
2. Removes unwanted elements:
   - `.twoRowsBlock`
   - `.post_signature`
   - `.spoiler`
   - MathJax rendered elements (`.MathJax_Preview`, `.mjx-chtml`, etc.)

#### B. Mathematical Notation Processing
1. Preserves `script[type="math/tex"]` elements containing LaTeX
2. Converts to proper delimiters:
   - Inline math: `$latex$`
   - Display math: `$$latex$$`
3. Determines math mode based on:
   - Parent element classes (`.MathJax_Display`)
   - Script attributes (`mode="display"`)
   - Script type (`display` in type)

#### C. Answer Section Detection
Uses regex patterns to identify where answer choices begin:
```javascript
let patterns = [
  /\(\s*[A-E]\s*\)/,  // (A), (B), etc.
  /[A-E]\s*\./,       // A., B., etc.
  /[A-E]\s*\)/,       // A), B), etc.
];
```

#### D. Answer Choice Parsing
1. Splits content at the first answer pattern match
2. Extracts all answer choices using comprehensive regex:
```javascript
/(?:(?:\(\s*([A-E])\s*\))|(?:([A-E])\s*\.?)|(?:([A-E])\s*\)))/g
```
3. Associates content with answer letters

#### E. Answer Choice Normalization
Converts all formats to standard `A. Choice text`:
- Preserves the content of each answer choice
- Formats consistently with letter + period + space

### 3. Overlay Interface
The overlay window includes:
- Question section with preserved formatting
- Answer Choices section with standardized format
- "Copy to Clipboard" button with visual feedback
- "Close" button to dismiss the overlay
- Responsive styling that covers most of the screen

### 4. Mathematical Typesetting
1. Configures MathJax with proper settings:
   - Inline math delimiters: `$...$` and `\(...\)`
   - Display math delimiters: `$$...$$` and `\[...\]`
2. Loads MathJax library if not already present:
   - Uses CDN: `https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js`
3. Typesets the overlay content after MathJax loads

### 5. Copy Functionality
- Combines question and answer content into a single text
- Removes HTML tags for clean text output
- Provides visual feedback when content is copied
- Handles clipboard API errors gracefully

### 6. Error Handling
- Validates presence of required DOM elements
- Provides specific error messages for missing elements
- Uses try/catch blocks for general error handling
- Handles MathJax loading and typesetting errors

## Usage

### Installation
1. Create a bookmark in your browser
2. Set the URL to the complete JavaScript code
3. Navigate to a GMAT Club quantitative question page
4. Click the bookmark to run the scraper

### Operation
1. Click the bookmarklet on any GMAT Club quant question page
2. An overlay window will appear with the parsed content
3. Mathematical notation will render automatically
4. Use the "Copy to Clipboard" button to copy the formatted content
5. Paste into your preferred study tool or document
6. Use the "Close" button to dismiss the overlay

## Supported Question Types
- Problem Solving questions
- Data Sufficiency questions

## Limitations
- Requires specific DOM structure (`.item.text`)
- May not work with significantly different page layouts
- Dependent on MathJax CDN availability
- Limited support for non-quantitative question types

## Maintenance
When updating the script, ensure:
1. Regex patterns are updated for new answer formats
2. DOM selectors match current GMAT Club structure
3. MathJax configuration remains compatible
4. Error handling stays comprehensive
5. Output formatting stays consistent
6. Test with various mathematical expressions

## Testing
The `final-test-all-cases.html` file can be adapted to test:
- Various mathematical notation formats
- Different answer choice structures
- MathJax rendering functionality
- UI functionality verification