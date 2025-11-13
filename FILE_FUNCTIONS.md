# GMAT Error Log Repository - File Functions Documentation

This document describes the purpose and functionality of each file in the GMAT error log repository.

## Overview

This repository contains a collection of tools designed to help GMAT students scrape, extract, and organize GMAT questions from various sources (GMATClub and GMAT-HERO). It also includes an error logging system to track practice questions and mistakes.

---

## Root Directory Files

### JavaScript Bookmarklets

#### `errorlog_popup.js`
**Purpose:** Quick error logging popup interface for saving GMAT questions to the error log database.

**Functionality:**
- Creates a floating popup window with input fields for question link and notes
- Auto-fills the current page URL as the question link
- Provides auto-suggestions for common GMAT terminology (VB→Verbal, Q→Quant, CR→Critical Reasoning, etc.)
- Accepts suggestions with Tab key
- Submits question data to the GMAT error log API (`https://gmat-errorlog.vercel.app/api/questions`)
- Uses keyboard shortcuts (Enter to save)

#### `gmat-logger-bookmarklet.js`
**Purpose:** Advanced GMAT question logger with smart parsing and tagging capabilities.

**Functionality:**
- Fetches categories and tags from the error log API
- Parses notes to automatically detect:
  - Section (Verbal, Quant, DI)
  - Category (e.g., Critical Reasoning, Problem Solving)
  - Difficulty (Easy, Medium, Hard)
  - Source (OG, GMATClub, TTP)
- Detects source from URL automatically
- Provides real-time auto-suggestions as you type
- Supports tag management (add/remove tags)
- Caches categories and tags in localStorage for 1 hour
- Displays parsed metadata preview before submission
- Submits formatted question data to the API

#### `gmatclub-all-question-scraping.js`
**Purpose:** Universal question scraper for GMATClub that auto-detects question type.

**Functionality:**
- Detects the GMAT section from page structure (Quant, Critical Reasoning, Reading Comprehension, Data Insights)
- Routes to appropriate extraction logic based on section
- Extracts question content, answer choices, and metadata
- Outputs structured JSON format
- Handles mathematical notation with MathJax support
- Provides copy-to-clipboard functionality

#### `gmatclub-quant-scraping.js`
**Purpose:** Specialized scraper for GMATClub quantitative (Quant) questions.

**Functionality:**
- Extracts Quant questions with mathematical notation
- Preserves MathJax/LaTeX expressions
- Converts math script tags to proper delimiters (`$...$` for inline, `$$...$$` for display)
- Parses answer choices in various formats (A., (A), A), etc.)
- Normalizes all answer choices to standard `A. [text]` format
- Creates JSON output with structure:
  ```json
  {
    "question_link": "",
    "source": "",
    "difficulty": "",
    "type": "Quant",
    "content": {
      "question_text": "...",
      "answer_choices": [],
      "correct_answer": "",
      "subtype": "Problem Solving"
    }
  }
  ```
- Renders math with MathJax in overlay display
- Copy-to-clipboard functionality for JSON output

#### `gmatclub-verbal-scraping.js`
**Purpose:** Specialized scraper for GMATClub Critical Reasoning questions.

**Functionality:**
- Extracts passage and question text separately
- Intelligently identifies the question by looking for question patterns
- Supports multiple answer choice formats (A., (A), A:, A;, A/, etc.)
- Normalizes all formats to `A. [text]`
- Cleans HTML entities and formatting
- Opens results in popup window with sections for:
  - Passage
  - Question
  - Answer Choices
- Copy-to-clipboard functionality with toast notification

#### `gmatclub-verbal-rc-scraping.js`
**Purpose:** Specialized scraper for GMATClub Reading Comprehension questions.

**Functionality:**
- Extracts passage text from `.bbcodeBoxOut` structure
- Identifies and highlights span elements as `**text**`
- Extracts multiple questions associated with a single passage
- Parses answer choices for each question
- Creates structured output with:
  - Passage title and text
  - Array of questions with answer choices
- Displays formatted content in overlay with highlighted text
- Copy-to-clipboard functionality

### HTML Test Files

#### `final-test-all-cases.html`
**Purpose:** Comprehensive test suite for all verbal scraping bookmarklets.

**Functionality:**
- Contains multiple test cases with different answer choice formats
- Allows testing of bookmarklet functionality in a controlled environment
- Tests all supported answer formats (parentheses, periods, colons, etc.)

#### `reading-testcase.html`
**Purpose:** Test case for Reading Comprehension scraper.

**Functionality:**
- Contains sample RC passage with multiple questions
- Uses standard `.bbcodeBoxOut` structure
- Tests passage extraction and question parsing

#### `test-verbal-rc.html`
**Purpose:** Additional test file for RC scraping functionality.

**Functionality:**
- Provides test cases for RC question extraction
- Validates proper parsing of passage and questions

### Documentation Files

#### `QuantGuide.md`
**Purpose:** Comprehensive documentation for the quantitative question scraper.

**Contents:**
- Overview of `gmatclub-quant-scraping.js` features
- Mathematical notation support (LaTeX, MathJax)
- Answer choice format support table
- Technical implementation details (DOM selection, content processing, math typesetting)
- Usage instructions and installation guide
- Supported question types (Problem Solving, Data Sufficiency)
- Limitations and maintenance guidelines

#### `.gitignore`
**Purpose:** Git configuration file to exclude files from version control.

**Contents:**
- Typically excludes `node_modules/`, temporary files, and other build artifacts

---

## `/docs` Directory

### `README-CLIPBOARD-FEATURE.md`
**Purpose:** Documentation for clipboard functionality in verbal scrapers.

**Contents:**
- Explanation of how clipboard feature works
- Implementation details using Clipboard API
- Testing instructions for bookmarklet
- Browser compatibility information (Chrome 66+, Firefox 63+, Safari 13.1+, Edge 79+)
- Multiple testing methods described

### `VerbalCRGuide.md`
**Purpose:** Comprehensive guide for the Critical Reasoning scraper.

**Contents:**
- Overview of features and content extraction
- Answer choice format support table (8 different formats)
- Technical implementation details:
  - DOM selection path
  - Content processing logic
  - Answer section detection using regex
  - Question identification algorithm
- Usage instructions
- Supported question types
- Limitations and maintenance guidelines

### `VerbalRCInstruction.md`
**Purpose:** Instructions for Reading Comprehension scraper (content not read, but likely similar to other guides).

### `GMAT-HERO-QuantScrapingGuide.md`
**Purpose:** Documentation for GMAT-HERO quant scraping tools (content not read, but likely covers GMAT-HERO specific structure).

---

## `/GMAT-HERO` Directory

This directory contains bookmarklets and tools specifically designed for the GMAT-HERO platform (different structure than GMATClub).

### JavaScript Bookmarklets

#### `gmat-hero-quant-scraping.js`
**Purpose:** Manual extraction of quant questions from GMAT-HERO platform.

**Functionality:**
- Targets GMAT-HERO DOM structure (`#right-panel`, `.question-stem`, `.standard-choices`)
- Extracts questions with KaTeX mathematical expressions
- Processes KaTeX annotations to extract LaTeX notation
- Converts to standard format with `$...$` delimiters
- Displays in popup with KaTeX rendering
- Copy-to-clipboard functionality

#### `gmat-hero-quant-auto-scraping.js`
**Purpose:** Automated batch extraction of multiple quant questions from GMAT-HERO.

**Functionality:**
- Provides control panel with Start/Stop buttons
- Automatically extracts current question
- Clicks "Next" button to navigate to next question
- Waits 2 seconds between extractions
- Real-time status updates and question count
- Saves all extracted questions to JSON file (`gmat-quant-{timestamp}.json`)
- Processes KaTeX math expressions for clean output

#### `gmat-hero-cr-scraping.js`
**Purpose:** Extraction of Critical Reasoning questions from GMAT-HERO platform.

**Functionality:**
- Targets GMAT-HERO CR structure
- Separates passage from question intelligently
- Looks for question patterns (which, what, how, why, etc.)
- Cleans HTML entities and formatting
- Extracts answer choices from options
- Displays formatted output

#### `gmat-hero-cr-autoscraping.js`
**Purpose:** Automated batch extraction of CR questions from GMAT-HERO (similar to quant auto-scraping).

#### `gmat-hero-ttp.js`
**Purpose:** Specialized scraper for Target Test Prep (TTP) questions (specific functionality not fully read).

### HTML Test Files

#### `math-renderer.html`
**Purpose:** Full-featured renderer for viewing scraped questions with mathematical notation.

**Functionality:**
- Accepts pasted content from bookmarklets
- Renders mathematical expressions using MathJax/KaTeX
- Supports JSON file upload for batch question viewing
- Displays questions in collapsible list format
- Handles currency dollar signs vs. math delimiters
- Click to expand/collapse individual questions

#### `quant-test.html`
**Purpose:** Test file for GMAT-HERO quant scraping structure (provides test environment).

#### `cr-sample.html`
**Purpose:** Sample CR question for testing CR scraper functionality.

#### `specific-case.html`
**Purpose:** Test case for specific edge cases or problematic questions.

### Documentation

#### `README-QUANT-SCRAPING.md`
**Purpose:** Comprehensive documentation for GMAT-HERO quant scraping tools.

**Contents:**
- Overview of manual and automated extraction features
- Expected HTML structure for GMAT-HERO
- Clipboard format with KaTeX notation examples
- JSON output format specification
- Instructions for using math renderer files
- JSON file upload feature documentation
- Testing instructions (17 different test files listed)
- Copy implementation details
- Parsing improvements and recent fixes (v1.2-v1.6)
- Fixes for complex math expressions, currency handling, and file uploads

---

## `/verbal-cr-testcases` Directory

Contains 5 HTML test case files for Critical Reasoning scraper testing:

### `testcase1.html` through `testcase5.html`
**Purpose:** Individual test cases for CR scraper validation.

**Functionality:**
- Provides various CR question formats for testing
- Tests different answer choice styles
- Validates passage/question separation logic
- Ensures proper HTML entity handling

---

## Repository Structure Summary

```
gmat-errorlog-popup/
├── Root Level Scripts (GMATClub scrapers + error logger)
├── docs/ (Documentation for various features)
├── GMAT-HERO/ (GMAT-HERO platform specific tools)
│   ├── Scrapers (manual and automated)
│   ├── Renderers (math-renderer.html, etc.)
│   └── Test files
└── verbal-cr-testcases/ (CR test cases)
```

---

## Key Technologies Used

- **MathJax/KaTeX**: For rendering mathematical expressions
- **Clipboard API**: For copy-to-clipboard functionality
- **LocalStorage**: For caching categories and tags
- **Fetch API**: For communicating with error log backend
- **Bookmarklets**: Browser bookmarks containing JavaScript code

---

## API Endpoints

The error logging system communicates with:
- **Base URL**: `https://gmat-errorlog.vercel.app` (production) or `http://localhost:5001` (development)
- **POST** `/api/questions` - Submit new question to error log
- **GET** `/api/categories` - Fetch question categories
- **GET** `/api/tags` - Fetch available tags

---

## Common JSON Output Format

Most scrapers output questions in this structure:

```json
{
  "question_link": "https://...",
  "source": "GMATClub|OG|TTP",
  "difficulty": "easy|medium|hard",
  "type": "Quant|CR|RC",
  "content": {
    // Structure varies by type
  }
}
```

---

## Version History Highlights

### GMAT-HERO Quant Scraper
- **v1.2**: Fixed complex mathematical answer choices
- **v1.3**: Fixed question formatting in auto-scraping
- **v1.4**: Fixed currency dollar signs
- **v1.5**: Added JSON file upload feature
- **v1.6**: Improved math expression handling

---

## Contributing

When modifying scrapers:
1. Test with all provided test files
2. Verify mathematical notation rendering
3. Check answer choice format normalization
4. Ensure clipboard functionality works
5. Update relevant documentation

---

## Notes

- All bookmarklets are designed to be self-contained (no external dependencies except CDN libraries)
- Error logging system requires active backend API
- Scrapers are brittle and depend on specific DOM structures
- Mathematical notation support requires MathJax/KaTeX CDN availability
