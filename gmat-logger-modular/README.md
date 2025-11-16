# GMAT Logger - Modular Version

A modular, lightweight version of the GMAT Error Log bookmarklet that loads only the necessary code for each page.

## Features

- **Smart Loading**: Only loads the extractor needed for the current page (GMATClub or GMAT Hero)
- **Smaller Initial Load**: ~900 lines vs ~2000 lines in monolithic version
- **Better Performance**: Faster startup and execution
- **Easier Maintenance**: Separate modules for each feature
- **Extensible**: Easy to add new extractors (TTP, Manhattan Prep, etc.)

## Architecture

```
gmat-logger-modular/
├── loader.js                    # Entry point (~50 lines)
├── core.js                      # UI & API logic (~800 lines)
├── utils.js                     # Shared utilities (~150 lines)
├── extractors/
│   ├── gmatclub.js             # GMATClub extraction (~700 lines)
│   └── gmathero.js             # GMAT Hero extraction (~400 lines)
└── README.md                    # This file
```

## Installation

### Option 1: Create Bookmarklet (Recommended)

1. Create a new bookmark in your browser
2. Name it "GMAT Logger (Modular)"
3. Paste this code as the URL:

```javascript
javascript:(function(){var s=document.createElement('script');s.type='module';s.src='https://cdn.jsdelivr.net/gh/huy-pm/gmat-errorlog@main/gmat-logger-modular/loader.js';document.head.appendChild(s);})();
```

**Note**: Replace `huy-pm/gmat-errorlog@main` with your actual GitHub repo path.

### Option 2: Direct Script Injection

Open browser console and run:

```javascript
var s=document.createElement('script');
s.type='module';
s.src='path/to/gmat-logger-modular/loader.js';
document.head.appendChild(s);
```

## Usage

1. Navigate to a GMAT question page:
   - **GMATClub**: https://gmatclub.com/forum/...
   - **GMAT Hero**: https://gmat-hero-v2.web.app/...

2. Click the bookmarklet or run the script

3. The modal will appear with:
   - Pre-filled question link
   - Smart notes field with autocomplete
   - Tag selection
   - Automatic question extraction (if supported)

4. Fill in your notes and click "Quick Add"

## How It Works

1. **Detection**: `loader.js` detects which site you're on
2. **Loading**: Loads `core.js` + `utils.js` + appropriate extractor
3. **Extraction**: Extracts question content from the page
4. **Enrichment**: Merges your input with extracted data
5. **Submission**: Sends to API with `question_data` field

### Loading Behavior

| Page | Modules Loaded | Total Size |
|------|----------------|------------|
| GMATClub | loader + core + utils + gmatclub | ~900 lines |
| GMAT Hero | loader + core + utils + gmathero | ~600 lines |
| Other | loader + core + utils | ~500 lines |

## Development

### Adding a New Extractor

1. Create `extractors/newsite.js`:

```javascript
import { decodeHtmlEntities } from '../utils.js';

export function extractNewSiteQuestion() {
  // Your extraction logic here
  return {
    question_link: "",
    source: "",
    difficulty: "",
    type: "Quant|CR|RC",
    content: {
      question_text: "...",
      answer_choices: [],
      correct_answer: ""
    }
  };
}
```

2. Update `utils.js` - add detection:

```javascript
export function detectQuestionSource(url) {
  if (url.includes('newsite.com')) {
    return 'newsite';
  }
  // ... existing code
}
```

3. Update `loader.js` - add loading:

```javascript
else if (source === 'newsite') {
  const { extractNewSiteQuestion } = await import('./extractors/newsite.js');
  setQuestionExtractor(extractNewSiteQuestion);
}
```

### Testing Locally

1. Start a local server:
```bash
python3 -m http.server 8000
```

2. Use this bookmarklet:
```javascript
javascript:(function(){var s=document.createElement('script');s.type='module';s.src='http://localhost:8000/gmat-logger-modular/loader.js';document.head.appendChild(s);})();
```

### Module Dependencies

```
loader.js
  ├── utils.js (shared utilities)
  ├── core.js (UI & API)
  │   └── utils.js
  └── extractors/*.js (page-specific)
      └── utils.js
```

## API Payload

The modular version sends the same payload as the monolithic version:

```json
{
  "question": "https://...",
  "source": "GMATClub",
  "section": "verbal",
  "category": "Weaken",
  "difficulty": "hard",
  "notes": "My notes here",
  "status": "Must Review",
  "tags": ["tag1", "tag2"],
  "questionData": {
    "question_link": "https://...",
    "source": "GMATClub",
    "difficulty": "hard",
    "type": "CR",
    "content": {
      "passage": "...",
      "question_text": "...",
      "answer_choices": ["A", "B", "C", "D", "E"],
      "correct_answer": "",
      "subtype": "Weaken"
    }
  }
}
```

## Comparison: Modular vs Monolithic

| Feature | Monolithic | Modular |
|---------|-----------|---------|
| Initial Load | ~2000 lines | ~500-900 lines |
| GMATClub Load | 2000 lines | ~900 lines |
| GMAT Hero Load | 2000 lines | ~600 lines |
| Other Pages | 2000 lines | ~500 lines |
| Maintainability | Single file | Multiple modules |
| Extensibility | Hard | Easy |
| Load Time | Slower | Faster |

## Troubleshooting

### Module Not Loading
- Check browser console for errors
- Ensure you're using `type='module'` in script tag
- Verify CDN path is correct

### Extractor Not Working
- Check if page structure has changed
- Review console logs for extraction errors
- Falls back to manual entry if extraction fails

### CORS Issues
- Ensure all modules are served from same origin
- Use CDN like jsdelivr for GitHub-hosted files

## License

Same as main project.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add/modify extractor in `extractors/`
4. Test locally
5. Submit pull request

## Version History

- **v2.0.0-modular** (2024): Initial modular architecture
  - Split into loader, core, utils, and extractors
  - Dynamic module loading
  - Improved performance
