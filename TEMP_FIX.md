# Temporary Fix Instructions

## Issue
The email notification endpoint returns 401 because authentication token is missing.

## Files to Update

### File: app/interview/room/page.tsx

**Location 1 (around line 923):**
```typescript
// CURRENT (WRONG):
if (sessionId) {
  fetch('/api/notifications/send-interview-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  }).catch(err => console.error('Failed to send completion email:', err));
}

// SHOULD BE:
if (sessionId) {
  const token = localStorage.getItem('authToken');
  fetch('/api/notifications/send-interview-complete', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: JSON.stringify({ sessionId })
  }).catch(err => console.error('Failed to send completion email:', err));
}
```

**Location 2 (around line 1436):**
Same fix - add token to headers.

## Summary
- ✅ Created results page at `/app/results/[sessionId]/page.tsx`
- ⚠️ Need to add auth token to 2 email notification calls in room page
