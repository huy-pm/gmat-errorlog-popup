## Authentication Bookmarklet Implementation
### Architecture Overview (Enhanced)
```Bookmarklet Enhanced Flow:
──────────────────────────

Click Bookmarklet
        │
        ▼
Initialize
        │
    Check for
    Shadow DOM
    Container
        │
        ▼
Load Auth from
localStorage
        │
   ┌────┴────────┐
   │             │
Valid Token   Invalid/Missing
   │             │
   │        window.open()
   │        Auth Popup
   │             │
   │        Listen for
   │        postMessage
   │             │
   │        VALIDATE ORIGIN ⭐
   │        event.origin ===
   │        'https://yourdomain.com'
   │             │
   │        Save Token
   │             │
   └────┬────────┘
        │
   Extract Data
        │
   Create Shadow DOM ⭐
   (CSS Isolated)
        │
   Show "Sending..."
   in Shadow Root
        │
   Send to API
        │
   Update Shadow DOM
   Status
```
### Components to Build

#### 3.1 Core Bookmarklet Script (Enhanced)

**Initialization:**

-   Check if already running (prevent duplicates)
-   Create Shadow DOM container for UI ⭐ NEW
-   Load authentication state from localStorage
-   Validate token expiration
-   Trigger authentication if needed

**Why Shadow DOM?** ⭐ CRITICAL
```
Without Shadow DOM:               With Shadow DOM:
────────────────                 ────────────────
Your overlay CSS                 Your overlay CSS
   ↓                                ↓
Mixed with host site            Completely isolated
   ↓                                ↓
Conflicts, breaks                Always works
button styling, etc.             perfectly
   ↓                                ↓
Inconsistent UX                  Consistent UX
across websites                  everywhere
```
**Shadow DOM Implementation Steps:**

1.  Create container: `document.createElement('div')`
2.  Attach shadow root: `container.attachShadow({ mode: 'closed' })`
3.  Inject HTML and CSS into shadow root
4.  Host page CSS cannot affect your UI
5.  Your CSS cannot leak out

#### 3.2 Authentication System (Origin-Validated)

**Storage Management:**

-   Key structure: `myapp_auth_${window.location.hostname}`
-   Store:
    -   Token
    -   User ID
    -   Expiration timestamp
    -   Refresh token (not used in bookmarklet)
-   Check expiration before each use
-   Clear on logout or expiration

**Authentication Flow (Secure):**
```
// WRONG (Your Original Plan):
window.addEventListener('message', (event) => {
  const token = event.data.token;  // ⚠️ Accepts from ANY origin!
  saveToken(token);
});

// CORRECT (Best Practice):
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://yourdomain.com') {
    console.error('Rejected message from', event.origin);
    return;  // ⛔ Stop attackers
  }
  const token = event.data.token;  // ✅ Safe
  saveToken(token);
});
```
**Why Origin Validation Matters:**

-   Malicious website could send fake token via postMessage
-   Without validation, attacker can hijack session
-   `event.origin` check prevents this attack vector
-   **ALWAYS validate origin** - non-negotiable security requirement

**Implementation Steps:**

1.  Detect missing or expired token
2.  Calculate centered popup position
3.  Open `/auth/external?source=bookmarklet`
4.  Add message listener with **origin validation**
5.  Only accept if `event.origin === 'https://yourdomain.com'`
6.  Save token to localStorage
7.  Close popup window
8.  Continue with data extraction

**Fallback Mechanism:**

-   Poll popup window for closure every 500ms
-   Check localStorage after closure
-   Handle popup blockers with user prompt
-   Timeout after 5 minutes

#### 3.4 Shadow DOM Status Overlay ⭐ NEW

**Why Shadow DOM is Critical:**

-   Host website's CSS won't break your overlay
-   Your CSS won't affect host website
-   Consistent appearance across all websites
-   Professional, isolated UI component

**Implementation:**

```
Shadow DOM Structure:
────────────────────

<div id="bookmarklet-root">      ← Attached to body
  #shadow-root (closed)           ← Shadow boundary
    <style>                       ← Scoped styles
      .overlay { ... }
    </style>
    <div class="overlay">         ← Your UI
      <div class="message">
        Status text here
      </div>
    </div>
```

#### Bookmarklet Testing

**Browser Compatibility:**

-   ✅ Chrome (latest 2 versions)
-   ✅ Firefox (latest 2 versions)
-   ✅ Safari (latest version)
-   ✅ Edge (latest version)

**Security Context:**

-   ✅ HTTPS pages (should work)
-   ✅ HTTP pages (should warn/fail)
-   ✅ Mixed content scenarios
-   ✅ CSP-restricted pages
-   ✅ Origin validation enforcement ⭐

**Shadow DOM Tests:** ⭐ NEW

-   ✅ UI renders correctly across websites
-   ✅ No CSS conflicts with host
-   ✅ Overlay always visible
-   ✅ Animations work smoothly
-   ✅ Close button functions
-   ✅ Responsive on mobile

**Storage Tests:**

-   ✅ localStorage availability
-   ✅ Quota limits
-   ✅ Incognito/private mode behavior
-   ✅ Cross-session persistence
-   ✅ Multi-tab scenarios

