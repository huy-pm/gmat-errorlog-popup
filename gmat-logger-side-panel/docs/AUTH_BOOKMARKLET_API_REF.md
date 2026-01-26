# Bookmarklet API Reference

## Overview

This document provides complete API reference for integrating the bookmarklet tool with the GMAT ErrorLog backend. All APIs use **Bearer token authentication** except the authentication page itself.

**Base URL:**
- Production: `https://your-domain.com`
- Development: `http://localhost:5173`

**Authentication Method:** Bearer Token (JWT)

**Required Headers:**
```http
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

---

## 🔐 Authentication Flow

### Overview

```
┌─────────────────┐
│  User clicks    │
│  bookmarklet    │
└────────┬────────┘
         │
    Check localStorage
    for valid token?
         │
    ┌────┴─────┐
    │          │
   Yes        No
    │          │
    │    window.open('/auth/external?source=bookmarklet')
    │          │
    │    User signs in with Clerk
    │          │
    │    Backend generates token
    │          │
    │    Page sends via postMessage
    │          │
    │    Save to localStorage
    │          │
    └────┬─────┘
         │
   Use token to
   send data
```

---

## API Endpoints

### 1. Authentication Page (Frontend)

#### GET `/auth/external`

**Purpose:** Unified authentication page for external tools

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Must be `'bookmarklet'` |

**Example:**
```
https://your-domain.com/auth/external?source=bookmarklet
```

**Flow:**
1. User is redirected to Clerk login (if not signed in)
2. After authentication, backend generates token
3. Page sends token to opener via `postMessage`
4. Window closes automatically

**postMessage Format:**
```javascript
{
  type: 'AUTH_TOKEN',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  userId: 'user_abc123',
  expiresAt: '2026-01-26T10:00:00Z',
  source: 'bookmarklet'
}
```

**Bookmarklet Implementation:**

```javascript
// Open auth popup
const authWindow = window.open(
  'https://your-domain.com/auth/external?source=bookmarklet',
  'GMATAuthPopup',
  'width=500,height=600,left=100,top=100'
);

// Listen for token
window.addEventListener('message', (event) => {
  // ⚠️ CRITICAL: Validate origin
  if (event.origin !== 'https://your-domain.com') {
    console.error('Rejected message from', event.origin);
    return;
  }
  
  if (event.data.type === 'AUTH_TOKEN') {
    // Save token
    localStorage.setItem('gmat_auth_token', event.data.token);
    localStorage.setItem('gmat_auth_expires', event.data.expiresAt);
    localStorage.setItem('gmat_user_id', event.data.userId);
    
    // Close popup if still open
    if (authWindow && !authWindow.closed) {
      authWindow.close();
    }
    
    // Continue with data extraction
    extractAndSendData();
  }
});
```

---

### 2. Token Generation (Server API)

#### POST `/api/auth/external/token`

**Purpose:** Generate new authentication token (requires existing Clerk session)

**Authentication:** Clerk session cookie (user must be logged in to web app)

**Request Body:**
```json
{
  "source": "bookmarklet",
  "deviceId": "optional-device-identifier",
  "deviceName": "My Browser - Chrome"
}
```

**Request Schema:**
```typescript
{
  source: 'bookmarklet',          // Required, must be 'bookmarklet'
  deviceId?: string,              // Optional, for tracking
  deviceName?: string             // Optional, friendly name for dashboard
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX2FiYzEyMyIsInNvdXJjZSI6ImJvb2ttYXJrbGV0IiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTY0MzY3MjQwMCwiZXhwIjoxNjQzNjc2MDAwLCJqdGkiOjEyM30.signature",
  "userId": "user_abc123",
  "expiresAt": "2026-01-25T17:33:31Z",
  "expiresIn": 3600,
  "source": "bookmarklet"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `token` | string | JWT token for API authentication |
| `userId` | string | Clerk user ID |
| `expiresAt` | string | ISO 8601 expiration timestamp |
| `expiresIn` | number | Seconds until expiration (3600 = 1 hour) |
| `source` | string | Always 'bookmarklet' |

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `UNAUTHORIZED` | No active Clerk session |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests (max 5/minute) |
| 500 | `INTERNAL_ERROR` | Server error |

**Example Error:**
```json
{
  "error": "Unauthorized",
  "message": "No active session found. Please sign in.",
  "code": "UNAUTHORIZED"
}
```

**Rate Limits:**
- 5 requests per minute per user
- Uses Clerk session for identification

---

### 3. Data Extraction

#### POST `/api/questions`

**Purpose:** Submit extracted data from bookmarklet

**Authentication:** Bearer token (in Authorization header)

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
              {
                        "question": "https://gmatclub.com/forum/over-the-past-5-years-company-x-has-posted-double-digit-growth-in-ann-103111.html", "source": "gmat-club", "section": "verbal", "category": "Assumption", "difficulty": "medium", "notes": "gap: prediction", "status": "Must Review", "mistakeTypes": [], "timeSpent": 32, "questionData": { "questionLink": "https://gmatclub.com/forum/over-the-past-5-years-company-x-has-posted-double-digit-growth-in-ann-103111.html", "source": "gmat-club", "questionType": "cr", "difficulty": "medium", "section": "verbal", "content": { "passage": "Over the past 5 years, Company X has posted double-digit growth in annual revenues, combined with a substantial improvement in operating margins. Since this growth is likely to persist in the future, the stock of Company X will soon experience dramatic appreciation.", "questionText": "The argument above is based on which of the following assumptions?", "answerChoices": ["Company X has a large market share in its industry.", "Prior to the last 5 years, Company X had experienced similarly dramatic growth in sales associated with stable or improving operating margins.", "The growth of Company X is likely to persist in the future.", "The current price of the stock of Company X does not fully reflect the promising growth prospects of the firm.", "The stock of Company X will outperform other stocks in the same industry."] }, "category": "Assumption", "selectedAnswer": "D", "correctAnswer": "D", "timeSpent": "02:01" }
                 }
```

**Response with Refresh Warning:**
```json
{
  "success": true,
  "message": "Data collected successfully",
  "recordId": "rec_xyz789",
  "tokenStatus": {
    "valid": true,
    "expiresIn": 600,
    "shouldRefresh": true,
    "warning": "Token expiring soon, please re-authenticate"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always true on success |
| `message` | string | Human-readable success message |
| `recordId` | string | Database record ID |
| `tokenStatus.valid` | boolean | Whether token is still valid |
| `tokenStatus.expiresIn` | number | Seconds until token expires |
| `tokenStatus.shouldRefresh` | boolean | True if < 10 minutes remaining |
| `tokenStatus.warning` | string | Optional warning message |

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `TOKEN_INVALID` | Invalid or expired token |
| 403 | `TOKEN_REVOKED` | Token has been revoked |
| 422 | `VALIDATION_ERROR` | Invalid data format |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests (max 60/minute) |
| 500 | `INTERNAL_ERROR` | Server error |

**Example Errors:**
```json
// Invalid token
{
  "error": "Token invalid or expired",
  "code": "TOKEN_INVALID",
  "message": "Please re-authenticate"
}

// Revoked token
{
  "error": "Token has been revoked",
  "code": "TOKEN_REVOKED",
  "message": "This token is no longer valid. Please generate a new one."
}

// Validation error
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "metadata.url",
      "message": "Invalid URL format"
    }
  ]
}
```

**Rate Limits:**
- 60 requests per minute per token
- Uses token ID for tracking

**CORS:**
- Accepts requests from any origin (uses Bearer tokens, not cookies)
- Preflight requests (OPTIONS) supported

---

### 4. Token Revocation (Optional)

#### POST `/api/auth/external/revoke`

**Purpose:** Revoke token(s) programmatically

**Authentication:** Clerk session cookie OR valid Bearer token

**Request Body:**
```json
{
  "tokenId": 123
}
```

**Alternative - Revoke all user tokens:**
```json
{
  "revokeAll": true
}
```

**Alternative - Revoke all bookmarklet tokens:**
```json
{
  "source": "bookmarklet"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token(s) revoked successfully",
  "revokedCount": 1
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `UNAUTHORIZED` | No authentication provided |
| 403 | `FORBIDDEN` | Cannot revoke other user's tokens |
| 404 | `NOT_FOUND` | Token not found |
| 422 | `VALIDATION_ERROR` | Invalid request body |

---

## 📝 Complete Bookmarklet Implementation Example

### Token Management Module

```javascript
// token.js - Token management utilities

const TOKEN_KEY = 'gmat_auth_token';
const EXPIRY_KEY = 'gmat_auth_expires';
const USER_KEY = 'gmat_user_id';
const API_BASE = 'https://your-domain.com';

/**
 * Check if we have a valid token
 * @returns {boolean}
 */
function hasValidToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(EXPIRY_KEY);
  
  if (!token || !expiresAt) return false;
  
  // Check if expired (with 5 minute buffer)
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  return now < (expiryTime - fiveMinutes);
}

/**
 * Get stored token
 * @returns {string|null}
 */
function getToken() {
  if (!hasValidToken()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Save token to localStorage
 * @param {Object} tokenData
 */
function saveToken(tokenData) {
  localStorage.setItem(TOKEN_KEY, tokenData.token);
  localStorage.setItem(EXPIRY_KEY, tokenData.expiresAt);
  localStorage.setItem(USER_KEY, tokenData.userId);
}

/**
 * Clear stored token
 */
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Authenticate user and get token
 * @returns {Promise<boolean>}
 */
function authenticate() {
  return new Promise((resolve) => {
    // Open auth popup
    const width = 500;
    const height = 600;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    
    const authWindow = window.open(
      `${API_BASE}/auth/external?source=bookmarklet`,
      'GMATAuthPopup',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    if (!authWindow) {
      alert('Popup blocked! Please allow popups for this site.');
      resolve(false);
      return;
    }
    
    // Listen for token
    const messageHandler = (event) => {
      // ⚠️ CRITICAL: Validate origin
      if (event.origin !== API_BASE) {
        console.error('Rejected message from', event.origin);
        return;
      }
      
      if (event.data.type === 'AUTH_TOKEN') {
        saveToken(event.data);
        
        // Close popup
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
        
        // Clean up listener
        window.removeEventListener('message', messageHandler);
        
        resolve(true);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Timeout after 5 minutes
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      resolve(false);
    }, 5 * 60 * 1000);
  });
}
```

---

### Data Collection Module

```javascript
// api.js - API communication

/**
 * Send data to collection endpoint
 * @param {Object} data - Your extracted data
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>}
 */
async function collectData(data, metadata = {}) {
  const token = getToken();
  
  if (!token) {
    throw new Error('No valid token. Please authenticate first.');
  }
  
  // Add default metadata
  const fullMetadata = {
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    ...metadata
  };
  
  const response = await fetch(`${API_BASE}/api/data/collect`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data,
      metadata: fullMetadata
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    
    // Handle specific error codes
    if (error.code === 'TOKEN_INVALID' || error.code === 'TOKEN_REVOKED') {
      clearToken();
      throw new Error(`Authentication failed: ${error.message}`);
    }
    
    throw new Error(error.message || 'Failed to collect data');
  }
  
  const result = await response.json();
  
  // Check if token expiring soon
  if (result.tokenStatus?.shouldRefresh) {
    console.warn('Token expiring soon, consider re-authenticating');
  }
  
  return result;
}
```

---

### Main Bookmarklet

```javascript
// bookmarklet.js - Main entry point

(async function() {
  'use strict';
  
  // Check for existing execution
  if (window.GMATBookmarkletRunning) {
    alert('Bookmarklet is already running!');
    return;
  }
  window.GMATBookmarkletRunning = true;
  
  try {
    // Show loading overlay
    showOverlay('Initializing...', 'loading');
    
    // Check authentication
    if (!hasValidToken()) {
      showOverlay('Please sign in...', 'info');
      const authenticated = await authenticate();
      
      if (!authenticated) {
        showOverlay('Authentication failed', 'error');
        setTimeout(() => hideOverlay(), 3000);
        return;
      }
    }
    
    // Extract data from page
    showOverlay('Extracting data...', 'loading');
    const extractedData = extractQuestionData(); // Your extraction logic
    
    if (!extractedData) {
      showOverlay('No data found on this page', 'warning');
      setTimeout(() => hideOverlay(), 3000);
      return;
    }
    
    // Send to API
    showOverlay('Sending data...', 'loading');
    const result = await collectData(extractedData);
    
    // Show success
    showOverlay('Data sent successfully!', 'success');
    setTimeout(() => hideOverlay(), 3000);
    
  } catch (error) {
    console.error('Bookmarklet error:', error);
    showOverlay(`Error: ${error.message}`, 'error');
    setTimeout(() => hideOverlay(), 5000);
  } finally {
    window.GMATBookmarkletRunning = false;
  }
})();

/**
 * Extract question data from page
 * @returns {Object|null}
 */
function extractQuestionData() {
  // Your custom extraction logic here
  // This will vary based on the target website
  
  return {
    questionId: '12345',
    questionText: 'Sample question...',
    userAnswer: 'B',
    correctAnswer: 'A',
    // ... more fields
  };
}
```

---

### Shadow DOM Overlay

```javascript
// overlay.js - Status overlay with Shadow DOM

let overlayContainer = null;
let shadowRoot = null;

/**
 * Create Shadow DOM overlay
 */
function createOverlay() {
  // Create container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'gmat-bookmarklet-overlay';
  document.body.appendChild(overlayContainer);
  
  // Attach shadow root (closed mode for encapsulation)
  shadowRoot = overlayContainer.attachShadow({ mode: 'closed' });
  
  // Add styles (isolated from page CSS)
  const style = document.createElement('style');
  style.textContent = `
    .overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .overlay.success { border-left: 4px solid #10b981; }
    .overlay.error { border-left: 4px solid #ef4444; }
    .overlay.warning { border-left: 4px solid #f59e0b; }
    .overlay.info { border-left: 4px solid #3b82f6; }
    .overlay.loading { border-left: 4px solid #8b5cf6; }
    
    .message {
      margin: 0;
      color: #1f2937;
      font-weight: 500;
    }
    
    .close {
      position: absolute;
      top: 8px;
      right: 8px;
      cursor: pointer;
      font-size: 20px;
      color: #6b7280;
      background: none;
      border: none;
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 1;
    }
    
    .close:hover {
      color: #1f2937;
    }
  `;
  
  shadowRoot.appendChild(style);
}

/**
 * Show overlay with message
 * @param {string} message
 * @param {string} type - 'success'|'error'|'warning'|'info'|'loading'
 */
function showOverlay(message, type = 'info') {
  if (!shadowRoot) createOverlay();
  
  const overlay = document.createElement('div');
  overlay.className = `overlay ${type}`;
  overlay.innerHTML = `
    <button class="close" onclick="this.getRootNode().host.remove()">×</button>
    <p class="message">${message}</p>
  `;
  
  // Clear previous content
  shadowRoot.innerHTML = '';
  shadowRoot.appendChild(shadowRoot.querySelector('style') || document.createElement('style'));
  shadowRoot.appendChild(overlay);
}

/**
 * Hide overlay
 */
function hideOverlay() {
  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
    shadowRoot = null;
  }
}
```

---

## 🔒 Security Best Practices

### 1. Origin Validation (CRITICAL)

**Always validate the origin when receiving postMessage:**

```javascript
// ❌ WRONG - Accepts from any origin
window.addEventListener('message', (event) => {
  const token = event.data.token;
  saveToken(token);
});

// ✅ CORRECT - Validates origin
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://your-domain.com') {
    console.error('Rejected message from', event.origin);
    return;
  }
  const token = event.data.token;
  saveToken(token);
});
```

### 2. Token Storage

**Use localStorage, scoped to page hostname:**

```javascript
// Scope by hostname to prevent cross-site access
const TOKEN_KEY = `gmat_auth_${window.location.hostname}`;
```

### 3. Token Expiration

**Always check expiration before using:**

```javascript
function hasValidToken() {
  const expiresAt = localStorage.getItem(EXPIRY_KEY);
  if (!expiresAt) return false;
  
  // Add buffer (5 minutes) to avoid edge cases
  const buffer = 5 * 60 * 1000;
  return Date.now() < (new Date(expiresAt).getTime() - buffer);
}
```

### 4. HTTPS Only

**Never use bookmarklet on HTTP pages:**

```javascript
if (window.location.protocol !== 'https:') {
  alert('This bookmarklet only works on HTTPS pages for security reasons.');
  return;
}
```

### 5. Error Handling

**Handle token revocation gracefully:**

```javascript
try {
  await collectData(data);
} catch (error) {
  if (error.message.includes('TOKEN_REVOKED')) {
    clearToken();
    alert('Your session has been revoked. Please sign in again.');
    await authenticate();
  }
}
```

---

## 📊 Rate Limits

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `/api/auth/external/token` | 5 requests | 1 minute | Per user |
| `/api/data/collect` | 60 requests | 1 minute | Per token |
| `/api/auth/external/revoke` | 20 requests | 1 hour | Per user |

**Rate Limit Response:**
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "message": "Please wait 60 seconds before trying again"
}
```

**Handling Rate Limits:**
```javascript
async function collectDataWithRetry(data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await collectData(data);
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED' && i < maxRetries - 1) {
        const delay = error.retryAfter * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

---

## 🧪 Testing Your Integration

### 1. Test Authentication Flow

```javascript
// Test script
async function testAuth() {
  console.log('Testing authentication...');
  
  clearToken(); // Start fresh
  const success = await authenticate();
  
  if (success) {
    console.log('✓ Authentication successful');
    console.log('Token:', getToken());
  } else {
    console.error('✗ Authentication failed');
  }
}
```

### 2. Test Data Collection

```javascript
async function testDataCollection() {
  console.log('Testing data collection...');
  
  const testData = {
    questionId: 'test-123',
    questionText: 'Test question',
    category: 'Test'
  };
  
  try {
    const result = await collectData(testData);
    console.log('✓ Data collection successful', result);
  } catch (error) {
    console.error('✗ Data collection failed', error);
  }
}
```

### 3. Test Token Expiration

```javascript
// Manually set expired token
localStorage.setItem('gmat_auth_token', 'old-token');
localStorage.setItem('gmat_auth_expires', '2020-01-01T00:00:00Z');

console.log('Has valid token?', hasValidToken()); // Should be false
```

---

## ❓ FAQ

### Q: How long does the token last?
**A:** Bookmarklet tokens expire after **1 hour**. You'll need to re-authenticate after that.

### Q: What happens if my token is revoked?
**A:** You'll receive a 403 error with code `TOKEN_REVOKED`. Clear the stored token and re-authenticate.

### Q: Can I use the same token across multiple devices?
**A:** Yes, but each device should ideally generate its own token for better tracking and security.

### Q: What data should I include in the collection payload?
**A:** Include whatever data your application needs. The schema is flexible - use the `data` object for your custom structure.

### Q: Do I need to handle CORS?
**A:** No, the backend is configured to accept requests from any origin for the `/api/data/collect` endpoint (secured via Bearer tokens).

### Q: How do I debug authentication issues?
**A:** 
1. Open browser console
2. Check for postMessage events
3. Verify origin validation
4. Check localStorage for token
5. Test token with `/api/data/collect`

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify you're on an HTTPS page
3. Ensure popups aren't blocked
4. Check token expiration
5. Review error codes in API responses

For additional help, contact the development team or file an issue in the project repository.
