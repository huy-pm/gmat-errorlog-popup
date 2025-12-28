# GMAT Hero Autoscraping Module

A unified, modular system for extracting GMAT questions from GMAT Hero practice pages.

## Features

- **Automatic Question Type Detection** - Detects Quant, Verbal (CR/RC), and all DI question types
- **Unified Interface** - Single entry point handles all question types
- **Modular Architecture** - Easy to extend with new question types
- **Clean Output** - Standardized JSON format for all question types

## Question Types Supported

| Type | Detection | Section |
|------|-----------|---------|
| Quant | `.katex` elements | quant |
| Critical Reasoning | `#right-panel .question-stem` (no passage/math) | verbal |
| Reading Comprehension | `#left-panel .passage` | verbal |
| Graphics Interpretation (GI) | `.dropdown-selection` | di |
| Multi-Source Reasoning (MSR) | `.ir-msr` | di |
| Table Analysis (TA) | `.ir-ta` | di |
| Two-Part Analysis (TPA) | `.tpa-question` | di |

## Usage

### Option 1: Load via Script Tag

Add to GMAT Hero page:
```html
<script type="module" src="path/to/gmat-hero-autoscraping/loader.js"></script>
```

### Option 2: Browser Console (ES Modules)

```javascript
import('./loader.js');
```

### Option 3: Bookmarklet (Coming Soon)

A bundled version for bookmarklet use will be available.

## Directory Structure

```
gmat-hero-autoscraping/
├── loader.js              # Entry point - detects section and type
├── core.js                # Popup UI, processing loop, state management
├── utils.js               # Shared utilities
├── README.md              # This file
└── extractors/
    ├── quant.js           # Quant extractor
    ├── cr.js              # Critical Reasoning extractor
    ├── rc.js              # Reading Comprehension extractor
    ├── di-gi.js           # Graphics Interpretation extractor
    ├── di-msr.js          # Multi-Source Reasoning extractor
    ├── di-ta.js           # Table Analysis extractor
    └── di-tpa.js          # Two-Part Analysis extractor
```

## Output Schemas

### Quant Question
```json
{
  "questionLink": "https://...",
  "source": "GMAT HERO",
  "difficulty": "medium",
  "section": "quant",
  "questionType": "quant",
  "category": "Algebra",
  "correctAnswer": "A",
  "content": {
    "questionText": "If $x + y = 10$...",
    "answerChoices": ["5", "10", "15", "20", "25"],
    "image": "https://..."
  }
}
```

### Verbal Question (CR/RC)
```json
{
  "questionLink": "https://...",
  "source": "GMAT HERO",
  "section": "verbal",
  "questionType": "verbal",
  "category": "CR",
  "content": {
    "passage": "A recent study found...",
    "questionText": "Which of the following...",
    "answerChoices": ["A...", "B...", "C...", "D...", "E..."],
    "highlightRanges": [{"start": 45, "end": 78}]
  }
}
```

### DI Graphics Interpretation (GI)
```json
{
  "questionLink": "https://...",
  "section": "di",
  "category": "GI",
  "content": {
    "image": "https://...",
    "questionText": "The graph shows...",
    "statements": [
      {
        "text": "The value is closest to {dropdown}",
        "dropdowns": [
          { "options": ["10", "20", "30"], "correctAnswer": "20" }
        ]
      }
    ]
  }
}
```

### DI Multi-Source Reasoning (MSR)
```json
{
  "questionSetLink": "https://...",
  "section": "di",
  "category": "MSR",
  "dataSources": {
    "tabs": [
      { "name": "Email 1", "content": { "text": "..." } }
    ]
  },
  "questions": [
    {
      "questionId": 1,
      "questionType": "binary",
      "questionText": "Based on...",
      "statements": [{ "text": "...", "correctAnswer": "Yes" }]
    }
  ]
}
```

### DI Table Analysis (TA)
```json
{
  "questionLink": "https://...",
  "section": "di",
  "category": "TA",
  "content": {
    "introText": "The table shows...",
    "table": {
      "headers": ["City", "Population"],
      "rows": [["NYC", "8M"]],
      "headerGroups": [{"label": "Location", "colspan": 2}],
      "legend": "Data as of 2023"
    },
    "statements": [{ "text": "...", "correctAnswer": "Yes" }]
  }
}
```

### DI Two-Part Analysis (TPA)
```json
{
  "questionLink": "https://...",
  "section": "di",
  "category": "TPA",
  "content": {
    "questionText": "Select one value...",
    "columnHeaders": ["Value for X", "Value for Y"],
    "rows": [{ "text": "10", "optionValue": "A" }],
    "correctAnswers": { "column1": "A", "column2": "C" }
  }
}
```

## Detection Logic

The module detects question type using DOM selectors (more reliable than URL):

```javascript
function detectQuestionType() {
  // DI Types (check first - specific containers)
  if (document.querySelector('.dropdown-selection'))  return 'di-gi';
  if (document.querySelector('.ir-msr'))              return 'di-msr';
  if (document.querySelector('.ir-ta'))               return 'di-ta';
  if (document.querySelector('.tpa-question'))        return 'di-tpa';
  
  // Verbal Types
  if (document.querySelector('#left-panel .passage')) return 'rc';
  if (document.querySelector('#right-panel .question-stem') && 
      !document.querySelector('#left-panel .passage') &&
      !document.querySelector('.katex'))              return 'cr';
  
  // Quant
  if (document.querySelector('.katex'))               return 'quant';
  
  return null;
}
```

## Extending

To add a new question type:

1. Create `extractors/new-type.js`
2. Export `extractQuestionData()` function
3. Add detection logic to `utils.js:detectQuestionType()`
4. Add extractor mapping to `core.js:loadExtractor()`

## License

MIT
