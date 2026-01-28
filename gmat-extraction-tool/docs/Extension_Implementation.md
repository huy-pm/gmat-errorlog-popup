## Phase 2: Chrome Extension Implementation

### Architecture Overview (Manifest V3 Best Practices)

```
Chrome Extension Structure (MV3):──────────────────────────────────┌────────────────────────────────────────┐│          manifest.json (V3)            ││  - chrome.identity permission          ││  - chrome.storage permission           ││  - chrome.alarms permission (refresh)  ││  - Service Worker (not persistent)     │└────────────────────────────────────────┘                    │        ┌───────────┴───────────┐        │                       │┌───────▼────────┐    ┌────────▼─────────┐│  Service       │    │   Popup UI       ││  Worker        │    │                  ││                │    │ - Login Button   ││ - Auth via     │◄───┤ - Extract Button ││   chrome.      │    │ - Status Display ││   identity     │───►│ - Token Manager  ││ - Token Store  │    │ - Logout Button  ││ - Heartbeat    │    └──────────────────┘│   Alarm (1hr)  ││ - API Calls    ││ - Messages     │└────────────────┘        │        │ Inject/Communicate        │┌───────▼────────┐│  Content.js    ││                ││ - Extract Data ││ - UI Inject    ││ - Send to SW   │└────────────────┘
```

### Components to Build

#### 2.1 Project Structure Setup

```
gmat-extraction-tool/
├── packages/
│   ├── core/                    # Shared logic (20% of codebase)
│   │   ├── src/
│   │   │   ├── extractor.ts     # DOM parsing - SINGLE SOURCE OF TRUTH
│   │   │   ├── api-client.ts    # API communication
│   │   │   ├── types.ts         # Shared TypeScript types
│   │   │   └── utils/
│   │   │       ├── dom.ts       # DOM manipulation helpers
│   │   │       ├── format.ts    # Data formatting
│   │   │       └── validation.ts# Data validation
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── bookmarklet/             # Bookmarklet-specific (15%)
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point (imports core)
│   │   │   ├── auth.ts          # Popup-based auth
│   │   │   ├── ui.ts            # Shadow DOM overlay
│   │   │   └── config.ts        # API endpoints
│   │   ├── build.js             # Post-build: minify + URL-encode
│   │   ├── package.json
│   │   └── vite.config.ts       # IIFE build config
│   │
│   └── extension/               # Chrome extension (65%)
│       ├── src/
│       │   ├── background/
│       │   │   ├── service-worker.ts  # Main orchestrator
│       │   │   ├── auth.ts            # chrome.identity wrapper
│       │   │   ├── token-manager.ts   # Token lifecycle + refresh
│       │   │   ├── alarm-handler.ts   # Heartbeat logic
│       │   │   └── message-router.ts  # Inter-component messaging
│       │   ├── content/
│       │   │   ├── content.ts         # Injection + extraction
│       │   │   └── ui-injector.ts     # Floating button
│       │   ├── popup/
│       │   │   ├── popup.html
│       │   │   ├── popup.ts           # Main popup logic
│       │   │   ├── popup.css
│       │   │   └── components/
│       │   │       ├── LoginView.ts
│       │   │       ├── ExtractView.ts
│       │   │       └── TokenManager.ts
│       │   ├── lib/
│       │   │   ├── messaging.ts       # Type-safe messages
│       │   │   ├── storage.ts         # chrome.storage wrapper
│       │   │   └── constants.ts
│       │   └── types/
│       │       └── chrome.d.ts        # Chrome API types
│       ├── public/
│       │   └── icons/                 # 16, 48, 128px
│       ├── manifest.json
│       ├── package.json
│       └── vite.config.ts             # ES modules build
```
Why This Structure?
Separation of Concerns:

Core: Pure extraction logic, no UI, no auth
Bookmarklet: Minimal wrapper around core
Extension: Full-featured wrapper with persistence
Build Targets:

Core: TypeScript library (not bundled)
Bookmarklet: Single minified IIFE file (<10KB)
Extension: Multiple ES modules with manifest
Benefits:

Update GMAT Club parser once, both tools work
Test core independently of UI/auth
Optimize each platform separately
Easy to add third platform (mobile app, CLI, etc.)
#### 2.2 Manifest Configuration (V3)

**Key Differences from V2:**

-   Use `"manifest_version": 3`
-   `background.service_worker` instead of `background.scripts`
-   `host_permissions` separate from `permissions`
-   `action` instead of `browser_action`

**Required Permissions:**

-   `identity` - For `chrome.identity.launchWebAuthFlow`
-   `storage` - For `chrome.storage.local`
-   `alarms` - For background token refresh heartbeat
-   `activeTab` - For content script injection
-   `scripting` - For programmatic script injection

**Host Permissions:**

-   `https://yourdomain.com/*` - Your auth domain
-   `https://api.yourdomain.com/*` - Your API domain

#### 2.3 Authentication System (Using chrome.identity)

**Service Worker (service-worker.js):**

**Core Responsibilities:**

1.  **Authentication Management**
    
    -   Use `chrome.identity.launchWebAuthFlow()` instead of opening tabs
    -   Handle OAuth redirect URL
    -   Store tokens securely
    -   Manage token lifecycle
2.  **Background Token Refresh (Heartbeat)** ⭐ BEST PRACTICE
    
    -   Set up `chrome.alarms` to trigger every hour
    -   Check token expiration time
    -   If < 24 hours remaining, call refresh endpoint
    -   Update stored token silently
    -   User never sees "Session Expired" error
3.  **Message Handling**
    
    -   Listen for messages from popup and content scripts
    -   Provide auth state to UI
    -   Handle logout requests
    -   Process data extraction requests

**Auth Flow Using chrome.identity:**

```
Traditional Flow (Your Plan):           Best Practice Flow:─────────────────────────               ──────────────────Open new tab                            chrome.identity.launchWebAuthFlow   ↓                                       ↓User sees full browser window           Focused popup (cleaner UI)   ↓                                       ↓Manual tab management                   Automatic closure   ↓                                       ↓Custom callback page needed             Native redirect handling   ↓                                       ↓Multiple moving parts                   Single API call
```

**Implementation Steps:**

1.  Call `chrome.identity.launchWebAuthFlow` with auth URL
2.  URL redirects to Clerk login
3.  After authentication, redirect to `https://[EXTENSION_ID].chromiumapp.org/oauth2`
4.  Chrome automatically captures redirect and returns URL to extension
5.  Extension extracts token from URL
6.  Store in `chrome.storage.local`
7.  Set up alarm for token refresh

**For** Redirect to `https://[EXTENSION_ID].chromiumapp.org/oauth2`  

You must manually add this exact URL to your **Clerk Dashboard > Allowed Redirect URLs**.

-   *Note:* The `EXTENSION_ID` is not generated until you upload a draft to the Chrome Web Store.
    
-   **Step Order:**
    
    1.  Build a dummy extension manifest.
        
    2.  Upload it to the Store (don't publish).
        
    3.  Get the ID.
        
    4.  Configure Clerk.
        
    5.  Hardcode the ID in your local development build to ensure the redirect works.
        

**Heartbeat Implementation:**

1.  On successful auth, create alarm: `chrome.alarms.create('tokenRefresh', { periodInMinutes: 60 })`
2.  Listen for alarm: `chrome.alarms.onAlarm.addListener(handleTokenRefresh)`
3.  In handler:
    -   Check token expiration
    -   If expiring within 24 hours, call `/api/auth/refresh`
    -   Update stored token
    -   Reset alarm if needed

#### 2.4 Data Extraction System

**Content Script:**

-   Inject into target website pages
-   Optional: Add floating "Extract Data" button
-   Extract data based on custom logic
-   Send data to service worker via `chrome.runtime.sendMessage`

**Service Worker API Handler:**

-   Receive data from content script or popup
-   Check authentication status
-   Check token expiration (refresh if needed)
-   Attach Bearer token to request
-   Send to `/api/questions`
-   Handle 401 (token revoked) vs 403 (token expired)
-   Notify popup/content script of result

#### 2.5 Popup Interface

**States:**

-   **Logged Out:**
    
    -   "Please log in" message
    -   "Log In" button
-   **Logged In:**
    
    -   User ID/email display
    -   Token expiration countdown
    -   "Extract Data" button
    -   "Manage Tokens" button (opens dashboard) ⭐ NEW
    -   "Log Out" button
-   **Token Manager View:** ⭐ NEW
    
    -   List of active devices/sessions
    -   Last used timestamp
    -   Revoke individual or all tokens

**Status Messages:**

-   Loading indicators
-   Success notifications
-   Error messages
-   Token refresh status
-   Auto-hide after 3 seconds

### Key Improvements Over Original Plan

✅ **Use `chrome.identity` instead of custom tab flow** - Cleaner, more secure✅ **Background token refresh** - Prevents "Session Expired" errors✅ **Token revocation support** - Better security management✅ **Alarm-based heartbeat** - Works with MV3 service workers✅ **Better error differentiation** - Expired vs revoked tokens

### Deliverables

-   ✅ Manifest V3 compliant extension
-   ✅ `chrome.identity` based authentication
-   ✅ Service worker with heartbeat refresh
-   ✅ Token management UI in popup
-   ✅ Content script for data extraction
-   ✅ Comprehensive error handling
