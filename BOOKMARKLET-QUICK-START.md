# Bookmarklet Manager - Quick Reference

## 🚀 Two Ways to Use It

### Method 1: Minified Bookmark (Static)
**Pros:** Works offline, no server needed  
**Cons:** Must re-minify and update bookmark every time you change code

1. Edit `bookmarklet-manager.js`
2. Minify it
3. Add `javascript:` prefix
4. Create bookmark with minified code

### Method 2: External Loader (Dynamic) ⭐ RECOMMENDED
**Pros:** Edit code anytime, bookmark never changes  
**Cons:** Requires local server (you already have one running!)

**One-time setup:**
1. Create a bookmark with this URL:
```javascript
javascript:(function(){var s=document.createElement('script');s.src='http://localhost:8000/bookmarklet-manager.js?ts='+(+new Date());document.head.appendChild(s);})();
```

2. That's it! Now you can edit `bookmarklet-manager.js` anytime and changes take effect immediately.

---

## 📝 Adding Bookmarklets

### Option A: Load External Script (Recommended for complex scripts)
```javascript
{
    name: "My Script",
    description: "Does something cool",
    code: function() {
        var s = document.createElement('script');
        s.src = 'http://localhost:8000/my-script.js?ts=' + (+new Date());
        document.head.appendChild(s);
    }
}
```

### Option B: Inline Code (Good for simple scripts)
```javascript
{
    name: "Copy URL",
    description: "Copy current URL",
    code: function() {
        navigator.clipboard.writeText(window.location.href);
        alert('Copied!');
    }
}
```

---

## 🎯 Your Current Setup

You have a CORS server running on `http://localhost:8000`, so you can:

1. **Use the loader bookmark** (recommended):
   ```javascript
   javascript:(function(){var s=document.createElement('script');s.src='http://localhost:8000/bookmarklet-manager.js?ts='+(+new Date());document.head.appendChild(s);})();
   ```

2. **Reference your existing scripts**:
   - `http://localhost:8000/gmat_hero_network_logger.js`
   - `http://localhost:8000/gmat-hero/gmat-hero-quant-auto-scraping.js`
   - Any other `.js` files in your project

---

## ✅ Current Examples in bookmarklet-manager.js

1. **Network Logger** - Loads external script from your server
2. **GMAT Hero Auto Scraping** - Loads external script
3. **Extract HTML** - Inline code that downloads HTML
4. **Copy Page URL** - Simple inline clipboard copy

You can mix and match both approaches!

---

## 🔧 Tips

- **Cache busting**: The `?ts=' + (+new Date())` ensures fresh code loads every time
- **Server must be running**: Your `python3 cors-server.py` must be running for external scripts
- **HTTPS sites**: Some HTTPS sites may block HTTP resources. Use HTTPS server if needed.
- **Debugging**: Open browser console to see any errors

---

## 🎨 Customization

Edit these in `bookmarklet-manager.js`:

- **Colors**: Change gradient in `.bookmarklet-manager-panel`
- **Size**: Adjust `max-width` and `padding`
- **Grid**: Modify `grid-template-columns` for button layout
- **Animations**: Tweak `@keyframes` sections

---

## 📦 File Structure

```
/Users/huyngo/Documents/Projects/gmat-errorlog-popup/
├── bookmarklet-manager.js          # Main manager (edit this!)
├── bookmarklet-loader.js           # Tiny loader reference
├── bookmarklet-manager-instructions.html  # Full guide
├── gmat_hero_network_logger.js     # Your script
└── gmat-hero/
    └── gmat-hero-quant-auto-scraping.js  # Your script
```

---

## 🚦 Quick Start

1. **Create the loader bookmark** (copy the javascript: URL above)
2. **Edit bookmarklet-manager.js** to add your scripts
3. **Make sure CORS server is running** (`python3 cors-server.py`)
4. **Click your bookmark** - done! 🎉

Every time you edit `bookmarklet-manager.js`, just click the bookmark again to see changes!
