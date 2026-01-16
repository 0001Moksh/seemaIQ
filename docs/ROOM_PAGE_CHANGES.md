# Interview Room Page - Critical Changes Needed

## Files to Modify
- `app/interview/room/page.tsx`
- `lib/groq.ts` (add language support)
- `lib/gemini.ts` (add language support)

---

## 1. Import AudioQueueManager

**Location:** Top of file (line 1-8)

**Add this import:**
```typescript
import { audioQueue } from '@/lib/audio-queue'
```

---

## 2. Replace speak() Function with Audio Queue

**Location:** Lines ~286-334 (current speak function)

**Replace entire speak function with:**
```typescript
const speak = async (text: string, role: Role, p?: Phase) => {
  if (!text.trim()) return Promise.resolve();
  
  try {
    setIsSpeaking(true);
    const phaseToUse = p ?? phase;
    const v = getVideoForPhase(role, phaseToUse);
    if (v) setVideoUrl(v);
    
    // Use audio queue instead of direct speech synthesis
    await audioQueue.speak(text, 'en-US', 1.2);
    
    setIsSpeaking(false);
    // Hide interviewer video after speaking unless we're in LISTENING phase
    if (phaseToUse !== 'LISTENING') setVideoUrl(null);
    
    // Mark question ready when a question just finished speaking
    if (phaseToUse === 'QUESTION') {
      setQuestionReady(true);
      setPhase('LISTENING');
    }
  } catch (err) {
    console.error('Speech error:', err);
    setIsSpeaking(false);
    if ((p ?? phase) !== 'LISTENING') setVideoUrl(null);
    
    // Ensure question ready even on error
    if ((p ?? phase) === 'QUESTION') {
      setQuestionReady(true);
      setPhase('LISTENING');
    }
  }
};
```

**Why this change:**
- Prevents audio interruptions
- Uses queue to ensure sequential playback
- No more overlapping questions
- Better error handling

---

## 3. Fix Video Element with Loop and Error Handling

**Location:** Find the video element in JSX (around line 1200-1400)

**Current code looks like:**
```tsx
{videoUrl && (
  <video
    src={videoUrl}
    className="w-full h-full object-cover rounded-lg"
    autoPlay
    muted
    playsInline
  />
)}
```

**Replace with:**
```tsx
{videoUrl && (
  <video
    key={videoUrl}
    src={videoUrl}
    className="w-full h-full object-cover rounded-lg"
    autoPlay
    loop
    muted
    playsInline
    onError={(e) => {
      console.error('Video load error:', videoUrl);
      // Retry loading after 1 second
      setTimeout(() => {
        if (e.currentTarget) {
          e.currentTarget.load();
        }
      }, 1000);
    }}
    onLoadedData={() => {
      console.log('Video loaded successfully:', videoUrl);
    }}
  />
)}
```

**Why this change:**
- `key={videoUrl}` forces re-render when video changes
- `loop` makes video repeat continuously
- `onError` handler retries failed video loads
- `onLoadedData` confirms successful loading

---

## 4. Improve Mic Access Control

**Location:** Find the mic button section (around line 1500-1600)

**Current code likely has a button that's always clickable. Replace the button section with:**

```tsx
{/* Show waiting message during question */}
{phase === 'QUESTION' && (
  <div className="text-center p-4">
    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
      <Sparkles className="w-4 h-4 animate-pulse" />
      <p className="text-sm font-medium">Question being asked... Please wait</p>
    </div>
  </div>
)}

{/* Show mic button only when in LISTENING phase after question completes */}
{phase === 'LISTENING' && !isRecording && questionReady && (
  <div className="text-center">
    <Button
      onClick={startRecording}
      className="px-8 py-6 text-lg"
      size="lg"
    >
      <Mic className="w-6 h-6 mr-2" />
      Start Answer
    </Button>
    <p className="text-sm text-muted-foreground mt-2">
      Click to begin your response
    </p>
  </div>
)}

{/* Recording in progress */}
{isRecording && (
  <div className="text-center">
    <Button
      onClick={stopRecording}
      variant="destructive"
      className="px-8 py-6 text-lg"
      size="lg"
    >
      <Mic className="w-6 h-6 mr-2" />
      Stop Recording
    </Button>
    {silenceCountdown !== null && (
      <p className="text-sm text-muted-foreground mt-2">
        Auto-stopping in {silenceCountdown}s due to silence...
      </p>
    )}
  </div>
)}
```

**Why this change:**
- User can't activate mic during question
- Clear visual feedback about state
- Better UX with helpful messages
- Prevents accidental early recording

---

## 5. Auto-start Recording After Question (Optional Enhancement)

**Location:** Inside the speak function after question completes

**Add this code at the end of speak function:**
```typescript
const speak = async (text: string, role: Role, p?: Phase) => {
  // ... existing code ...
  
  // After speaking completes
  if (phaseToUse === 'QUESTION') {
    setQuestionReady(true);
    setPhase('LISTENING');
    
    // Optional: Auto-start recording after 500ms
    setTimeout(() => {
      if (!isRecording) {
        startRecording();
      }
    }, 500);
  }
}
```

**Why this change:**
- Smoother UX - no manual click needed
- Starts recording automatically
- 500ms delay feels natural

---

## 6. Add Language Support to Orchestrate API

**Location:** `app/api/interview/orchestrate/route.ts`

**Changes needed:**
1. Accept `language` parameter from request body
2. Pass `language` to Groq/Gemini functions
3. Store language in session metadata

**Example update:**
```typescript
// In orchestrate route handler
const { action, role, language = 'english', ...rest } = await req.json();

// When calling generateInterviewQuestion:
const question = await generateInterviewQuestion({
  ...resumeData,
  role,
  language, // Pass language
  previousQuestions: body.previousQuestions || []
});
```

---

## 7. Update Groq generateInterviewQuestion

**Location:** `lib/groq.ts`

**Add language parameter:**
```typescript
export async function generateInterviewQuestion(context: {
  name: string;
  role: string;
  language?: string; // Add this
  domain?: string;
  skills?: string[];
  experience?: string;
  previousQuestions?: string[];
}) {
  const { language = 'english', ...rest } = context;
  
  // Add language instruction to system prompt
  const languageInstruction = language === 'hindi' 
    ? 'Ask the question in Hindi (Hinglish is acceptable for technical terms).'
    : 'Ask the question in English.';
  
  const systemPrompt = getSystemInstructions({
    ...rest,
    language
  }) + `\n\n${languageInstruction}`;
  
  // ... rest of function
}
```

---

## 8. Network Quality Optimization

**Already done in current code! ✅**
- Network checks reduced to every 30 seconds (line 101)
- Stops checking when interview completes

---

## 9. Session Data Caching (Add this optimization)

**Location:** In useEffect where session is loaded (line ~116)

**Add ref for caching:**
```typescript
// Add ref at top with other refs
const sessionDataCache = useRef<any>(null);

// In init function:
const init = async () => {
  if (!sessionId || !isLoggedIn) return;
  
  // Check cache first
  if (sessionDataCache.current?.sessionId === sessionId) {
    console.log('Using cached session data');
    return;
  }
  
  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`/api/interview/session?sessionId=${sessionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    
    if (!res.ok) {
      startRound('hr');
      return;
    }
    
    const data = await res.json();
    // Cache the session data
    sessionDataCache.current = { sessionId, data };
    
    const sess = data.session;
    // ... rest of existing code
  } catch (err) {
    startRound('hr');
  }
};
```

---

## 10. Clear Audio Queue on Cleanup

**Location:** In cleanup() function (around line 221)

**Add this line:**
```typescript
const cleanup = () => {
  // Add this at the beginning
  audioQueue.clear();
  
  // ... rest of existing cleanup code
  if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  // ... etc
};
```

---

## Testing Checklist

After making these changes, test:

- [ ] Audio doesn't overlap (questions don't interrupt each other)
- [ ] Video plays continuously and loops
- [ ] Video recovers from loading errors
- [ ] Mic button only appears after question completes
- [ ] Recording starts smoothly
- [ ] Language selection works (if implemented)
- [ ] Interview completes successfully
- [ ] No console errors
- [ ] Network quality indicator works
- [ ] Break timer functions correctly

---

## Summary of Improvements

1. **Audio Queue**: Prevents overlapping speech ✅
2. **Video Fixes**: Loop and error recovery ✅
3. **Mic Control**: Only after question completes ✅
4. **Language Support**: Hindi/English selection ✅
5. **Performance**: Reduced API calls ✅
6. **UX**: Better visual feedback ✅
7. **Reliability**: Better error handling ✅

All changes are backward compatible and improve the existing functionality without breaking current features.
