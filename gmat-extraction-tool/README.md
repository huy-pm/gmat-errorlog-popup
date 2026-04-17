# GMAT Logger - Side Panel (Modular)

A modular, resizable side panel version of the GMAT Error Log bookmarklet with AI assistance and smart note parsing.

## Features

- **Resizable Side Panel**: Fixed sidebar that overlays any website with drag-to-resize functionality
- **Modal-Aware**: Automatically adjusts z-index to stay visible over modals and popups
- **Smart Loading**: Only loads the necessary code for each page (GMATClub or GMAT Hero)
- **AI Assistant**: Integrated Gemini AI for automatic question analysis
- **Smart Parsing**: Intelligent note parsing with autocomplete for categories, sections, and difficulty
- **Tag Management**: Full mistake tag support with API integration
- **Question Extraction**: Automatic extraction of question data from supported sites
- **Keyboard Shortcuts**: Ctrl+L (Cmd+L on Mac) to toggle sidebar

## Architecture

```
gmat-logger-side-panel/
├── loader.js                    # Entry point (~50 lines)
├── core.js                      # Sidebar UI & logic (~1000 lines)
├── utils.js                     # Shared utilities (~200 lines)
├── extractors/
│   ├── gmatclub.js             # GMATClub extraction (~700 lines)
│   └── gmathero.js             # GMAT Hero extraction (~400 lines)
└── README.md                    # This file
```

## Installation

### Option 1: Create Bookmarklet (Recommended)

1. Create a new bookmark in your browser
2. Name it "GMAT Logger Side Panel"
3. Paste this code as the URL:

```javascript
javascript:(function(){var s=document.createElement('script');s.type='module';s.src='https://cdn.jsdelivr.net/gh/YOUR-USERNAME/YOUR-REPO@main/gmat-logger-side-panel/loader.js';document.head.appendChild(s);})();
```

**Note**: Replace `YOUR-USERNAME/YOUR-REPO@main` with your actual GitHub repo path.

### Option 2: Local Development

1. Start a local server:
```bash
python3 -m http.server 8000
```

2. Use this bookmarklet:
```javascript
javascript:(function(){var s=document.createElement('script');s.type='module';s.src='http://localhost:8000/gmat-logger-side-panel/loader.js';document.head.appendChild(s);})();
```

### Option 3: Direct Script Injection

Open browser console and run:

```javascript
var s=document.createElement('script');
s.type='module';
s.src='path/to/gmat-logger-side-panel/loader.js';
document.head.appendChild(s);
```

## Usage

### Basic Workflow

1. Navigate to a GMAT question page:
   - **GMATClub**: https://gmatclub.com/forum/...
   - **GMAT Hero**: https://gmat-hero-v2.web.app/...
   - **Any other page**: Works for manual logging

2. Click the bookmarklet or use **Ctrl+L / Cmd+L** to open sidebar

3. **Manual Log Tab**:
   - Question link is auto-populated
   - Type smart notes with autocomplete (e.g., "weaken hard")
   - Add mistake tags by clicking suggested tags
   - Review parsed information
   - Click "Quick Add" to submit

4. **AI Assistant Tab**:
   - Configure Gemini API key in Settings (one-time)
   - Click "Run AI Analysis" to analyze the page
   - AI extracts reasoning, tags, and summary
   - Switch to Manual Log tab to review and edit before submitting

### Smart Notes Examples

The system automatically parses your notes:

```
Input: "weaken hard - fell for trap answer"
→ Category: Weaken | Difficulty: Hard | Notes: "fell for trap answer"

Input: "quant med wp - forgot to check constraints"
→ Section: Quant | Difficulty: Medium | Category: Word Problems | Notes: "forgot to check constraints"

Input: "cr assumption easy"
→ Section: Verbal | Category: Assumption | Difficulty: Easy
```

### Keyboard Shortcuts

- **Ctrl+L / Cmd+L**: Toggle sidebar open/closed
- **Tab**: Accept autocomplete suggestion
- **Escape**: Dismiss autocomplete suggestions

### Sidebar Controls

- **Drag left edge**: Resize the sidebar width
- **Close button (×)**: Collapse sidebar to the right
- **Expand button**: Re-open collapsed sidebar
- **Settings gear**: Configure Gemini API key

## How It Works

### Loading Sequence

1. **Detection**: `loader.js` detects which site you're on
2. **Module Loading**: Loads `core.js` + `utils.js` + appropriate extractor
3. **Sidebar Creation**: Creates fixed sidebar with Shadow DOM
4. **Data Fetching**: Fetches categories and tags from API
5. **Auto-population**: If supported page, pre-fills difficulty and category

### Data Flow

```
User Input → Smart Parsing → Autocomplete → Tag Selection
                                                ↓
                                        Question Extraction (if supported)
                                                ↓
                                        Enrichment & Validation
                                                ↓
                                            API Submission
                                                ↓
                                        Success → Collapse Sidebar
```

### Loading Behavior

| Page | Modules Loaded | Total Size |
|------|----------------|------------|
| GMATClub | loader + core + utils + gmatclub | ~1200 lines |
| GMAT Hero | loader + core + utils + gmathero | ~800 lines |
| Other | loader + core + utils | ~600 lines |

## Configuration

### API Endpoints

The sidebar automatically detects localhost and switches between:
- **Production**: `https://gmat-errorlog.vercel.app`
- **Development**: `http://localhost:5001`

### Gemini API Key (Optional)

For AI Assistant features:
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click Settings gear in sidebar
3. Enter and save your API key
4. Key is stored locally in browser

## Development

### File Structure

**loader.js**: Entry point
- Detects current page source
- Dynamically imports modules
- Loads appropriate extractor
- Initializes sidebar

**core.js**: Main logic
- State management
- Sidebar UI creation
- Parsing & autocomplete
- API communication
- Event handling
- AI analysis

**utils.js**: Shared utilities
- Constants and configuration
- Icons (SVG strings)
- Mappings for parsing
- Helper functions

**extractors/*.js**: Page-specific extraction
- GMATClub question extraction
- GMAT Hero question extraction
- Returns standardized question JSON

### Adding a New Extractor

1. Create `extractors/newsite.js`:

```javascript
/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text) {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

/**
 * Extract question from newsite.com
 */
export async function extractNewSiteQuestion() {
  try {
    // Your extraction logic here
    return {
      question_link: window.location.href,
      source: "NewSite",
      difficulty: "Medium", // Easy|Medium|Hard
      type: "CR", // Quant|CR|RC
      content: {
        question_text: "...",
        answer_choices: ["A", "B", "C", "D", "E"],
        correct_answer: "C",
        category: "Weaken" // For CR questions
      }
    };
  } catch (error) {
    console.error('NewSite extraction error:', error);
    return null;
  }
}
```

2. Update `utils.js` - add detection:

```javascript
export function detectQuestionSource(url) {
  if (!url) return null;
  if (url.includes('gmatclub.com')) {
    return 'gmatclub';
  } else if (url.includes('gmat-hero-v2.web.app')) {
    return 'gmathero';
  } else if (url.includes('newsite.com')) {
    return 'newsite';
  }
  return null;
}
```

3. Update `loader.js` - add loading:

```javascript
else if (source === 'newsite') {
  console.log('Loading NewSite extractor...');
  const { extractNewSiteQuestion } = await import(`${basePath}extractors/newsite.js${cacheBuster}`);
  setQuestionExtractor(extractNewSiteQuestion);
  console.log('NewSite extractor loaded');
}
```

### Testing Locally

1. Make changes to files
2. Clear browser cache or use cache-busting parameter
3. Reload bookmarklet
4. Check console for module loading messages

## API Payload

The sidebar sends this payload to your API:

```json
{
  "question": "https://...",
  "source": "GMATClub",
  "section": "verbal",
  "category": "Weaken",
  "difficulty": "hard",
  "notes": "My notes here",
  "status": "Must Review",
  "mistakeTypes": ["Careless", "Fell Trap Answer Choice"],
  "questionData": {
    "question_link": "https://...",
    "source": "GMATClub",
    "difficulty": "Hard",
    "type": "CR",
    "content": {
      "passage": "...",
      "question_text": "...",
      "answer_choices": ["A", "B", "C", "D", "E"],
      "correct_answer": "C",
      "category": "Weaken"
    }
  }
}
```

## Comparison: Side Panel vs Modal

| Feature | Modal Version | Side Panel Version |
|---------|---------------|-------------------|
| Layout | Center overlay | Fixed right panel |
| Resizable | No | Yes (drag to resize) |
| Persistent | Blocks page | Works alongside page |
| Keyboard Toggle | No | Yes (Ctrl+L) |
| Z-Index Handling | Static | Dynamic (modal-aware) |
| Screen Space | Takes center | Uses right margin |

## Troubleshooting

### Sidebar Not Appearing
- Check browser console for errors
- Verify script tag has `type='module'`
- Check if already injected (look for existing sidebar)

### Module Import Errors
- Ensure all files are in correct locations
- Check file paths in loader.js
- Verify CORS settings if loading from CDN

### Extractor Not Working
- Check page structure hasn't changed
- Review console logs for extraction errors
- Falls back to manual entry if extraction fails

### Z-Index Issues
- Sidebar automatically detects modals
- Checks every second for new high z-index elements
- Manually adjusts to stay on top

### Sidebar Width Issues
- Drag the left edge (gray handle) to resize
- Width persists in state during session
- Resets to 400px on page reload

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (use Cmd+L for shortcuts)

## License

Same as main project.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes in appropriate module
4. Test with local server
5. Submit pull request

## Version History

- **v2.1.0-sidebar-modular** (2024): Side panel with modular architecture
  - Resizable sidebar with drag handle
  - Modal-aware z-index management
  - Keyboard shortcuts
  - AI Assistant integration
  - Smart parsing with autocomplete
  - Dynamic module loading

## Credits

Based on the original GMAT Error Log bookmarklet, enhanced with:
- Side panel UI design
- Modular architecture from gmat-logger-modular
- AI assistance with Gemini API
- Smart parsing and autocomplete
