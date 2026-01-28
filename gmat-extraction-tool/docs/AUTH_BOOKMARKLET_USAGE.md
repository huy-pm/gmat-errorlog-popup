# Bookmarklet Integration - Quick Reference

## Overview

Your bookmarklet should continue using the **existing `/api/questions` POST endpoint**. This endpoint now supports **both Clerk session auth (for web app) and Bearer token auth (for bookmarklet/extension)**.

---

## Authentication Flow

### 1. Get Token (One-time)

Navigate user to: `https://your-domain.com/auth/external?source=bookmarklet`

**What happens:**
1. User signs in with Clerk (if not already)
2. Server generates JWT token
3. Token sent back via `postMessage`
4. Save token in `localStorage`

**Implementation:**
```javascript
// Store token from postMessage
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://your-domain.com') return;
  
  if (event.data.type === 'AUTH_TOKEN') {
    localStorage.setItem('gmat_auth_token', event.data.token);
    localStorage.setItem('gmat_auth_expires', event.data.expiresAt);
  }
});
```

---

## 2. Send Data to `/api/questions`

### Endpoint
```
POST /api/questions
```

### Headers
```http
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

### Request Body (Your Current Format)
```json
{
  "question": "https://gmatclub.com/forum/...",
  "source": "gmat-club",
  "section": "verbal",
  "category": "Assumption",
  "difficulty": "medium",
  "notes": "gap: prediction",
  "status": "Must Review",
  "mistakeTypes": [],
  "timeSpent": 32,
  "questionData": {
    "questionLink": "https://gmatclub.com/forum/...",
    "source": "gmat-club",
    "questionType": "cr",
    "difficulty": "medium",
    "section": "verbal",
    "content": {
      "passage": "...",
      "questionText": "...",
      "answerChoices": ["A", "B", "C", "D", "E"]
    },
    "category": "Assumption",
    "selectedAnswer": "D",
    "correctAnswer": "D",
    "timeSpent": "02:01"
  }
}
```

**No changes needed!** Use your exact same payload structure.

---

## Complete Example

```javascript
async function sendQuestion(questionData) {
  const token = localStorage.getItem('gmat_auth_token');
  
  if (!token) {
    // Redirect to auth
    window.open('https://your-domain.com/auth/external?source=bookmarklet');
    return;
  }
  
  const response = await fetch('https://your-domain.com/api/questions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(questionData)
  });
  
  if (response.status === 401 || response.status === 403) {
    // Token expired or revoked - need to re-authenticate
    localStorage.removeItem('gmat_auth_token');
    window.open('https://your-domain.com/auth/external?source=bookmarklet');
    return;
  }
  
  if (!response.ok) {
    throw new Error(`Failed to save question: ${response.statusText}`);
  }
  
  return await response.json();
}

// Usage
sendQuestion({
  question: "https://gmatclub.com/forum/...",
  source: "gmat-club",
  section: "verbal",
  category: "Assumption",
  // ... rest of your payload
});
```

---

## Key Points

✅ **Keep using `/api/questions`** - No need to change your endpoint  
✅ **Same payload format** - No changes to your data structure  
✅ **Add Authorization header** - `Bearer YOUR_TOKEN`  
✅ **Handle 401/403** - Re-authenticate when token expires/revoked  
✅ **CORS enabled** - Works from any domain  

---

## Token Lifetime

- **Bookmarklet tokens**: 1 hour
- **Extension tokens**: 7 days

After expiration, user needs to re-authenticate via `/auth/external?source=bookmarklet`.

---

## What Changed vs Before

**Before:** Required Clerk session cookie (only worked from same domain)  
**After:** Accepts Bearer token OR Clerk session (works from anywhere)

Your bookmarklet just needs to add the `Authorization: Bearer` header!
