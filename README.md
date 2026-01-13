# SeemaIQ - Architecture & Data Flow Diagrams

## 1. High-Level User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                        SEEMAIQ PLATFORM                          │
└─────────────────────────────────────────────────────────────────┘

    Landing Page
         │
         ├─→ [LOGIN]
         │     └─→ Google OAuth or Email/Password
         │
         └─→ [SIGNUP]
               └─→ Create Account
                   │
                   ↓
            Dashboard
              │
              ├─→ View Past Sessions
              ├─→ Manage Profile
              │
              └─→ [START NEW INTERVIEW]
                    │
                    ↓
            Interview Setup
              │
              ├─→ Select Experience Level
              ├─→ Select Domain
              ├─→ Select # Questions Per Round ✨
              ├─→ Select/Upload Resume
              │
              └─→ [CREATE SESSION]
                    │
                    ↓
              Interview Room (3 Rounds)
              │
              ├─→ HR Round (5 questions)
              ├─→ BREAK
              ├─→ Technical Round (5 questions)
              ├─→ BREAK
              ├─→ Manager Round (5 questions)
              │
              └─→ Results Page
                    ├─→ Overall Score
                    ├─→ Round-by-Round Analysis
                    └─→ Download PDF Report
```

---

## 2. Gemini API Integration Points

```
┌──────────────────────────────────────────────────────────────────┐
│                    GEMINI API USAGE IN SEEMAIQ                    │
└──────────────────────────────────────────────────────────────────┘

API CALLS PER INTERVIEW (3 rounds × 5 questions each):
│
├─ RESUME PARSING (1 call)
│  ├─ Input: Resume PDF/DOC text
│  ├─ Output: Structured ResumeData
│  └─ Model: gemini-2.5-flash
│
├─ QUESTION GENERATION (15 calls)
│  ├─ Round 1: 5 HR questions
│  ├─ Round 2: 5 Technical questions
│  ├─ Round 3: 5 Manager questions
│  └─ Model: gemini-2.5-flash
│     ├─ Input: Role, experience, domain, resume context
│     └─ Output: AI-generated interview question
│
├─ ANSWER EVALUATION (15 calls)
│  ├─ For each question-answer pair
│  └─ Model: gemini-2.5-flash
│     ├─ Input: Question + User's answer
│     └─ Output: Scores (clarity, relevance, completeness, confidence) + feedback
│
└─ TOTAL PER INTERVIEW: ~31 API calls
```

---

## 3. Backend API Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                             │
└──────────────────────────────────────────────────────────────────┘

Authentication APIs
├─ POST /api/auth/register
├─ POST /api/auth/login
├─ POST /api/auth/verify-otp
└─ GET  /api/auth/google

Profile APIs
├─ GET  /api/profile
└─ POST /api/profile

Interview Session APIs
├─ POST /api/interview/session/create      → Create new session
├─ GET  /api/interview/session              → Fetch session details
├─ POST /api/interview/pause                → Pause interview
└─ POST /api/interview/leave                → Leave interview

Resume APIs
└─ POST /api/interview/parse-resume         → Parse & extract resume data

Interview Orchestration APIs
└─ POST /api/interview/orchestrate          → Main orchestrator
    ├─ action: "greet"      → Get greeting
    ├─ action: "question"   → Generate question (Gemini)
    └─ action: "evaluate"   → Evaluate answer (Gemini)

Results APIs
├─ POST /api/interview/results               → Fetch interview results
├─ POST /api/interview/feedback              → Get detailed feedback
├─ POST /api/interview/suggestions           → Get improvement suggestions
└─ POST /api/interview/download-pdf          → Generate PDF report
```

---

## 4. Detailed Interview Room Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              INTERVIEW ROOM - QUESTION/ANSWER CYCLE               │
└──────────────────────────────────────────────────────────────────┘

USER ACTION: Start Recording
    │
    ↓
┌─────────────────────────────┐
│ startRecording()            │
│ └─ Get microphone access    │
│ └─ Start MediaRecorder      │
│ └─ Start SpeechRecognition  │
└─────────────────────────────┘
    │
    ↓
┌─────────────────────────────┐
│ Web Speech API              │
│ └─ rec.onresult             │
│ └─ Transcribes audio → text │
│ └─ Updates transcript       │
└─────────────────────────────┘
    │
    ↓ (User speaking detected)
┌─────────────────────────────┐
│ Reset Silence Timer         │
│ └─ Wait 6 seconds silence   │
└─────────────────────────────┘
    │
    ├─→ User speaks again? 
    │   └─ Restart timer
    │
    └─→ 6 seconds silence?
        │
        ↓
        ┌──────────────────────────────┐
        │ Show Silence Detected        │
        │ Start 3-second countdown     │
        │ Allow user to speak to cancel│
        └──────────────────────────────┘
        │
        ├─→ User speaks? → Cancel countdown
        │
        └─→ Countdown reaches 0?
            │
            ↓
    ┌─────────────────────────────────────┐
    │ Submit Answer                       │
    │ POST /api/interview/orchestrate     │
    │ {                                   │
    │   action: "evaluate",               │
    │   question: "...",                  │
    │   answer: "user's transcribed text",│
    │   role: "hr"|"technical"|"manager", │
    │   sessionId: "...",                 │
    │   questionsPerRound: 5              │
    │ }                                   │
    └─────────────────────────────────────┘
        │
        ↓
    ┌──────────────────────────────────┐
    │ Backend: evaluateInterviewAnswer()│
    │ └─ Gemini API call               │
    │ └─ Parse JSON response           │
    │ └─ Calculate scores              │
    │ └─ Save to MongoDB               │
    └──────────────────────────────────┘
        │
        ↓
    ┌──────────────────────────────────┐
    │ Response to Frontend:            │
    │ {                                │
    │   clarity: 80,                   │
    │   relevance: 85,                 │
    │   completeness: 75,              │
    │   confidence: 70,                │
    │   feedback: "feedback text",     │
    │   candidate_score: 77            │
    │ }                                │
    └──────────────────────────────────┘
        │
        ↓
    ┌──────────────────────────────────┐
    │ Show Feedback to User            │
    │ ├─ Scores visualization          │
    │ ├─ Feedback text                 │
    │ └─ [Next Question] button        │
    └──────────────────────────────────┘
        │
        └─→ More questions?
            └─→ Load next question
                └─→ Repeat cycle
        
        └─→ Round complete?
            └─→ Round evaluation
                └─→ Show suggestions
                    └─→ Break / Next round
```

---

## 5. Gemini Question Generation Process

```
┌──────────────────────────────────────────────────────────────────┐
│           QUESTION GENERATION - DETAILED FLOW                     │
└──────────────────────────────────────────────────────────────────┘

Input:
├─ role: "hr" | "technical" | "manager"
├─ experience: "junior" | "mid" | "senior"
├─ round: 1 | 2 | 3
├─ previousQuestions: string[]
├─ resumeData: { name, skills, experience, projects, ... }
└─ domain: "software" | "data" | "product" | "design" | "devops" | "other"

Process:
    ↓
┌──────────────────────────────────────────┐
│ 1. Domain Inference (if not provided)   │
│                                          │
│ Search resumeData for keywords:         │
│ ├─ React/Next → software               │
│ ├─ Python/ML → data                    │
│ ├─ Product/PM → product                │
│ ├─ Figma/UI → design                   │
│ └─ Docker/AWS → devops                 │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 2. Build Domain Description             │
│    "Software Engineering (Web, Mobile..."│
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 3. Build Resume Context                 │
│                                          │
│ For HR Role:                             │
│ ├─ Recent experience                    │
│ ├─ Top skills                           │
│ └─ Summary                              │
│                                          │
│ For Technical Role:                      │
│ ├─ All skills                           │
│ ├─ Projects                             │
│ └─ Technical roles                      │
│                                          │
│ For Manager Role:                        │
│ ├─ All experience                       │
│ └─ Leadership indicators                │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 4. Build Gemini Prompt                  │
│                                          │
│ Include:                                 │
│ ├─ Role of interviewer                  │
│ ├─ Round number                         │
│ ├─ Domain description                   │
│ ├─ Resume context                       │
│ ├─ Previous questions to avoid          │
│ └─ Special instructions (if HR+Round1)  │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 5. Call Gemini API                      │
│                                          │
│ POST gemini-2.5-flash:generateContent   │
│ - Model: gemini-2.5-flash               │
│ - Temperature: 0.7 (balanced)           │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 6. Process Response                     │
│                                          │
│ ├─ Extract text                         │
│ ├─ Remove markdown symbols              │
│ ├─ Validate length > 15 chars           │
│ └─ Clean formatting                     │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ 7. Error Handling                       │
│                                          │
│ ├─ 429 (Quota exceeded)                 │
│ │   └─ Switch API key                   │
│ │   └─ Throw QuotaExceededError         │
│ │                                        │
│ └─ Other errors                         │
│     └─ Use fallback question            │
│        (hardcoded question pool)        │
└──────────────────────────────────────────┘
    ↓
Output: "Generated interview question"
```

---

## 6. Data Storage Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    MONGODB COLLECTIONS                            │
└──────────────────────────────────────────────────────────────────┘

Collection: users
├─ _id: ObjectId
├─ email: string
├─ password: hashed
├─ name: string
├─ phone: string
├─ createdAt: Date
└─ updatedAt: Date

Collection: profiles
├─ _id: ObjectId
├─ userId: ObjectId (ref)
├─ data: {
│   name, email, phone, summary,
│   skills[], experience[], projects[], etc.
│ }
├─ createdAt: Date
└─ updatedAt: Date

Collection: sessions
├─ _id: ObjectId
├─ userId: ObjectId (optional)
├─ resumeData: ResumeData object
├─ role: "hr" | "technical" | "manager"
├─ experience: "junior" | "mid" | "senior"
├─ questionsPerRound: number (1-15)
├─ currentRound: number (1-3)
├─ questionIndex: number
├─ questions: [
│   {
│     text: string,
│     round: number,
│     questionNum: number,
│     createdAt: Date
│   }
│ ]
├─ answers: [
│   {
│     question: string,
│     answer: string,
│     evaluation: {
│       clarity: number,
│       relevance: number,
│       completeness: number,
│       confidence: number,
│       feedback: string
│     },
│     round: number,
│     createdAt: Date
│   }
│ ]
├─ status: "active" | "paused" | "completed"
├─ lastMeta: { ... }
├─ createdAt: Date
├─ updatedAt: Date
└─ expiresAt: Date (7 days TTL)

Collection: otps (for email verification)
├─ _id: ObjectId
├─ email: string
├─ otp: string (hashed)
├─ expiresAt: Date (TTL)
└─ createdAt: Date
```

---

## 7. State Management Flow (Frontend)

```
┌──────────────────────────────────────────────────────────────────┐
│              REACT STATE IN INTERVIEW ROOM PAGE                   │
└──────────────────────────────────────────────────────────────────┘

Key State Variables:
├─ phase: "GREET" | "QUESTION" | "LISTENING" | "FEEDBACK" | ...
├─ currentRole: "hr" | "expert" | "manager"
├─ questionCount: number (current question #)
├─ round: number (current round 1-3)
├─ questionsPerRound: number (user-configured, 1-15)
├─ currentQuestion: { text, audio, ... }
├─ transcript: [{ type: "question|answer", text }, ...]
├─ isRecording: boolean
├─ silenceDetected: boolean
├─ silenceCountdown: number | null
├─ error: { message, retryAfter } | null
├─ isMuted: boolean
└─ roundScores: { 1: score, 2: score, 3: score }

Refs (Persist Across Renders):
├─ recorderRef: MediaRecorder | null
├─ recognitionRef: SpeechRecognition | null
├─ silenceTimerRef: NodeJS.Timeout | null
├─ countdownRef: NodeJS.Timeout | null
├─ audioChunksRef: Blob[]
├─ currentAnswer: { current: string }
└─ lastActivityRef: { current: timestamp }
```

---

## 8. Complete Interview Statistics

```
PER INTERVIEW:
├─ Rounds: 3
├─ Questions per round: Configurable (1-15, default 5)
├─ Total questions: 15 (at default)
├─ Total answer evaluations: 15
├─ Total Gemini API calls: ~31
│  ├─ 1 resume parsing
│  ├─ 15 question generation
│  └─ 15 answer evaluation
│
├─ Interview duration (estimate, default):
│  ├─ 2 minutes per question (avg)
│  ├─ 1 minute per evaluation
│  ├─ 3 minutes break between rounds
│  └─ Total: ~75 minutes (1h 15min)
│
├─ Data generated:
│  ├─ Session document
│  ├─ 15 questions
│  ├─ 15 answers
│  ├─ 15 evaluations
│  └─ Aggregated scores
│
└─ Storage: ~10-20 KB per session
```

---

## 9. Error Handling & Fallbacks

```
┌──────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING STRATEGY                        │
└──────────────────────────────────────────────────────────────────┘

GEMINI API QUOTA EXCEEDED (429 Error)
├─ Detect: err.status === 429
├─ Action: switchGeminiApiKey()
├─ Result: Retry with backup API key
└─ Fallback: If both fail, use hardcoded questions

RESUME PARSING FAILS
├─ PDF text extraction fails
├─ Fallback: Use placeholder text
└─ Result: Manual entry option available

SPEECH RECOGNITION ERRORS
├─ "no-speech": Microphone not detecting audio
│  └─ Action: Auto-retry after 2 seconds
│
├─ "audio-capture": Microphone not available
│  └─ Action: Show error, suggest checking browser permissions
│
└─ "network": Network timeout
   └─ Action: Retry mechanism built-in

GEMINI QUESTION GENERATION FAILS
├─ Primary: Try Gemini generation
├─ Fallback: Use pre-written question templates
└─ Result: Always provide a question

GEMINI EVALUATION FAILS
├─ Primary: Try Gemini evaluation
├─ Fallback: Return default scores (75 each)
└─ Result: User still gets feedback (generic)
```

---

**Last Updated:** January 13, 2026
