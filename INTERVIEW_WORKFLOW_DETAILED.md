# 🎯 SeemaIQ Interview Workflow - Complete Detailed Explanation

## Table of Contents
1. [Overview](#overview)
2. [Pre-Interview Setup](#pre-interview-setup)
3. [The Interview Room](#the-interview-room)
4. [Interview Phases](#interview-phases)
5. [Three Rounds Explained](#three-rounds-explained)
6. [Backend API Orchestration](#backend-api-orchestration)
7. [Audio & Speech Processing](#audio--speech-processing)
8. [Evaluation & Scoring](#evaluation--scoring)
9. [Session State Management](#session-state-management)

---

## Overview

SeemaIQ simulates a real **3-round interview process** with AI-powered interviewers. Each round focuses on different competencies and uses Groq's Llama API to generate questions, evaluate answers, and provide real-time feedback.

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERVIEW JOURNEY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. LOGIN/SIGNUP  →  2. SETUP  →  3. INTERVIEW ROOM  →  4. RESULTS
│                                      (3 Rounds)                 │
│                                                                   │
│  ▼ SETUP PHASE ▼          ▼ INTERVIEW ROOM ▼                   │
│  • Upload Resume           • AI Greeting                        │
│  • Select Domain          • Question Generation                │
│  • Select Experience      • Audio Recording                    │
│  • Questions Per Round    • Answer Evaluation                 │
│  • Session Created        • Feedback & Suggestions             │
│                           • Round Evaluation                    │
│                           • Break Timer                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Interview Setup

### Step 1: Authentication
- User logs in or creates account at `/auth/login` or `/auth/signup`
- Auth token stored in `localStorage`
- User object available via `useAuth()` hook

### Step 2: Interview Configuration (`/interview/setup`)

User provides:

#### **A. Resume Data** (3 options)
```
┌─ OPTION 1: Use Saved Profile ──┐
│ • Loads from database          │
│ • Fetches via /api/profile     │
│ • Falls back to localStorage   │
└────────────────────────────────┘

┌─ OPTION 2: Upload PDF/DOC ─────┐
│ • File upload via form         │
│ • Sent to /api/parse-resume   │
│ • Groq extracts structure      │
│ • User can edit parsed data    │
└────────────────────────────────┘

┌─ OPTION 3: Manual Entry ───────┐
│ • Type name, skills, exp       │
│ • Create projects              │
│ • Add education                │
└────────────────────────────────┘
```

#### **B. Experience Level**
```
Dropdown: Junior | Mid (default) | Senior
→ Affects question difficulty & evaluation standards
```

#### **C. Interview Domain**
```
✓ Software Engineering
✓ Data Science & AI/ML
✓ Product Management
✓ UI/UX Design
✓ DevOps / Cloud
```

#### **D. Questions Per Round**
```
Slider: 3 - 15 questions (default: 5)
→ User controls interview length
→ Each round uses same count
→ Total questions = questionsPerRound × 3 rounds
```

### Step 3: Session Creation

```
POST /api/interview/session/create

Request Body:
{
  userId: "user_id",
  resumeData: {
    name: "John Doe",
    email: "john@example.com",
    skills: ["React", "Node.js", "Python"],
    experience: [...],
    education: [...],
    projects: [...],
    domain: "software"  // User selected
  },
  experience: "mid",
  questionsPerRound: 5
}

Response:
{
  sessionId: "session_uuid",
  status: "active"
}

Storage:
- sessionId stored in URL: /interview/room?sessionId=...
- Session data stored in database
```

---

## The Interview Room

### Initialization (`page.tsx` - useEffect)

```typescript
const init = async () => {
  // 1. Validate session exists
  GET /api/interview/session?sessionId={sessionId}
  
  // 2. Check session status
  if (sess.status === 'paused') {
    // Resume mode: restore previous state
    - setCurrentRole(sess.role)
    - setRound(sess.currentRound)
    - setTranscript(sess.questions + sess.answers)
    - setPhase('BREAK')
  } else {
    // New session: start first round
    - setCurrentRole('hr')
    - setRound(1)
    - startRound('hr')
  }
  
  // 3. Join session
  POST /api/interview/join { sessionId }
}
```

### Session Persistence

```
Paused Session Flow:
├─ User refreshes page
├─ Session fetched from DB
├─ Questions/answers restored
├─ Phase set to BREAK
├─ User can resume with "Continue to Next Round"
└─ No data lost

Active Session Flow:
├─ User navigates directly to room
├─ New session created
├─ Starts with HR greeting
└─ Full 3-round interview begins
```

---

## Interview Phases

### Phase State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│                      PHASE FLOW DIAGRAM                          │
├──────────────────────────────────────────────────────────────────┤

START (Round 1-3)
  ↓
GREET
  • Video: Interviewer greeting
  • Audio: AI-generated greeting via Web Speech API
  • Shows: Name, tone appropriate to interviewer
  ↓
QUESTION
  • Video: Interviewer asking question
  • Audio: Question spoken via Web Speech API
  • Shows: Question text in left panel
  ↓
LISTENING ← (User's Turn)
  • Video: Interviewer listening (looping)
  • Microphone: OPEN - Recording user answer
  • Detection: Speech recognition active
  • Silence Timer: 6s silence + 3s countdown
  ↓
FEEDBACK
  • Video: Interviewer responding
  • Audio: Feedback from Groq
  • Shows: Improvement areas
  ↓
→ QUESTION (Next Q) OR EVALUATING (Last Q)
  ↓
EVALUATING
  • Video: Interviewer
  • Calling: Round evaluation endpoint
  ↓
SUGGESTIONS
  • Video: Interviewer
  • Audio: Improvement tips for round
  ↓
BREAK
  • Video: Interviewer profile image
  • Timer: 30-second countdown
  • Action: "Continue to Next Round" button OR auto-advance
  ↓
GREET (Round 2) → QUESTION → ... → SUGGESTIONS → BREAK
  ↓
GREET (Round 3) → QUESTION → ... → SUGGESTIONS → BREAK
  ↓
COMPLETE
  • Redirect: /dashboard
  • Results displayed with scores

└──────────────────────────────────────────────────────────────────┘
```

### Phase Details

#### **GREET Phase**
```typescript
// Triggered: Start of each round
// Duration: ~3-5 seconds

setPhase('GREET')
setVideoUrl(`/videos/{role}/greet.mp4`)

fetchGreeting(role)
  → POST /api/interview/orchestrate
    { action: 'greet', role, resumeData, domain }
  → Response: greeting text
  
speak(greetingText)
  → Web Speech API (SpeechSynthesisUtterance)
  → Played while video shows

setTimeout(() => fetchQuestion(1), 1200)
  → Auto-transition to first question
```

#### **QUESTION Phase**
```typescript
// Triggered: After greeting or feedback
// Duration: ~10-15 seconds (speaking time)

setPhase('QUESTION')
setVideoUrl(`/videos/{role}/question.mp4`)

fetchQuestion(questionNumber)
  → POST /api/interview/orchestrate
    {
      action: 'question',
      role,
      round,
      questionNum,
      previousQuestions: [Q1, Q2, ...],
      resumeData,
      questionsPerRound
    }
  → Response: new question text
  
speak(questionText)
  → Question read aloud
  → User can see transcript in left panel
  → Video shows interviewer

setQuestionReady(true)  // After speaking done
setPhase('LISTENING')   // Auto-transition
```

#### **LISTENING Phase** (User's Answer)
```typescript
// Triggered: After question fully spoken
// Duration: User-controlled (with auto-submit)

setPhase('LISTENING')
setVideoUrl(`/videos/{role}/listening.mp4`) // Loop

startRecording()
  ├─ Get microphone access
  ├─ Create MediaRecorder
  ├─ Start audio chunks collection
  └─ Start speech recognition

startSpeechRecognition()
  ├─ Use Web Speech API (Chrome, Edge, Safari)
  ├─ lang: 'en-IN' (Indian English)
  ├─ continuous: true
  ├─ interimResults: true
  │
  └─ Callbacks:
      onstart → speechStarted = false
      
      onresult → 
        final += final speech
        interim = interim speech
        currentAnswer.current += final
        updateLastAnswer(currentAnswer + interim)
        resetSilenceTimer()
      
      onerror → handle mic/network issues
      onend → restart if no speech detected

resetSilenceTimer()
  ├─ STEP 1: Wait 6 seconds silence
  │  └─ setSilenceDetected(true)
  │
  └─ STEP 2: Show 3-second countdown
     └─ sec = 3, 2, 1, 0
     └─ At 0: setIsMuted(true) + submitAnswer()

💡 User can speak during countdown to reset timer
```

#### **FEEDBACK Phase**
```typescript
// Triggered: After answer submission
// Duration: ~5-8 seconds

Groq evaluates answer:
POST /api/interview/orchestrate
{
  action: 'evaluate',
  role,
  round,
  question,
  answer,
  completedCount,
  questionsPerRound
}

Response:
{
  evaluation: {
    clarity: 75,
    relevance: 85,
    completeness: 70,
    confidence: 80,
    feedback: "Good communication. Consider deeper examples."
  },
  improvement_tips: "Add more specific examples from projects"
}

setPhase('FEEDBACK')
setVideoUrl(`/videos/{role}/conversation.mp4`)
setFeedbackText(feedback)

speak(feedback)
  → Feedback read aloud
  → User sees in left panel

setTimeout(() => {
  if (questionCount < maxQuestions) {
    fetchQuestion(nextQuestion)  → QUESTION phase
  } else {
    evaluateRound()              → EVALUATING phase
  }
}, 3000)
```

#### **EVALUATING Phase**
```typescript
// Triggered: After last question feedback
// Duration: ~2-5 seconds (processing)

Fetching round evaluation:
POST /api/interview/orchestrate
{
  action: 'evaluate',
  role,
  round,
  completedCount: questionsPerRound,
  questionsPerRound,
  sessionId
}

Response includes:
{
  evaluation: {
    overallScore: 78,
    clarity: 80,
    technicalKnowledge: 75,
    improvementTips: [...]
  }
}

setRoundEvaluation(data.evaluation)
```

#### **SUGGESTIONS Phase**
```typescript
// Triggered: During EVALUATING
// Duration: ~10-15 seconds

setPhase('SUGGESTIONS')
setVideoUrl(`/videos/{role}/conversation.mp4`)

setSuggestionsText(improvementTips)

speak(suggestions)
  → Tips read aloud
  → User sees in left panel

setTimeout(() => setPhase('BREAK'), 2000)
```

#### **BREAK Phase**
```typescript
// Triggered: After suggestions (Rounds 1-2) or end (Round 3)
// Duration: 30 seconds

setPhase('BREAK')
setBreakTimer(30)

Timer countdown:
├─ 30, 29, 28, ... 1, 0
└─ Every 1 second decrement

Display:
├─ Interviewer profile image
├─ "Break Time — Next Round in {timer}s"
└─ Button: "Continue to Next Round" (for manual advance)

On timer = 0:
  └─ moveToNextRound()
      ├─ nextRole = {hr → expert → manager → complete}
      ├─ If Round 4+: COMPLETE phase
      └─ Else: startRound(nextRole)
```

#### **COMPLETE Phase**
```typescript
// Triggered: After all 3 rounds
// Duration: 2 seconds

setPhase('COMPLETE')
setTimeout(() => router.push('/dashboard'), 2000)

Results page shows:
├─ Round 1 (HR): Score + Feedback
├─ Round 2 (Expert): Score + Feedback
├─ Round 3 (Manager): Score + Feedback
├─ Overall Score
└─ PDF Download option
```

---

## Three Rounds Explained

### 🟢 **Round 1: HR Interview** (Mira Sharma)
```
Focus Areas:
├─ Communication & articulation
├─ Soft skills & attitude
├─ Culture fit & motivation
├─ Work ethics & responsibility
└─ Listening & collaboration

Question Examples:
├─ "Tell me about yourself"
├─ "Why are you interested in this role?"
├─ "Describe a challenge you overcame"
├─ "How do you handle conflicts?"
└─ "What are your career goals?"

Evaluation Metrics:
├─ Clarity (0-100): How clear and articulate?
├─ Relevance (0-100): How relevant to question?
├─ Completeness (0-100): How thorough?
└─ Confidence (0-100): How confident?

Role Assignment:
  currentRole = 'hr'
  round = 1
  role parameter in API = 'hr'
```

### 🟠 **Round 2: Technical/Expert Interview** (Ashish Yadav)
```
Focus Areas:
├─ Technical depth & breadth
├─ Problem-solving approach
├─ Architecture & design knowledge
├─ Code quality awareness
└─ System thinking

Question Examples (Domain-Based):
- Software:
  ├─ "Design a URL shortener system"
  ├─ "Explain async/await"
  └─ "What's your experience with microservices?"

- Data Science:
  ├─ "How would you handle missing data?"
  ├─ "Explain cross-validation"
  └─ "Design a recommendation system"

- Product Management:
  ├─ "How would you prioritize features?"
  ├─ "Walk through your product strategy"
  └─ "How do you measure success?"

Evaluation Metrics:
├─ Technical Knowledge (0-100)
├─ Problem Solving (0-100)
├─ Architecture Sense (0-100)
└─ Explanation Quality (0-100)

Role Assignment:
  currentRole = 'expert'
  round = 2
  role parameter in API = 'expert'
```

### 🔵 **Round 3: Manager Interview** (Ryan Bhardwaj)
```
Focus Areas:
├─ Leadership qualities
├─ Decision-making
├─ Team collaboration
├─ Ownership mentality
└─ Long-term thinking

Question Examples:
├─ "Tell about a time you led a project"
├─ "How do you handle underperforming team members?"
├─ "Describe a strategic decision you made"
├─ "How do you balance quality and delivery?"
└─ "What's your management philosophy?"

Evaluation Metrics:
├─ Leadership (0-100)
├─ Strategic Thinking (0-100)
├─ Team Building (0-100)
└─ Decision Making (0-100)

Role Assignment:
  currentRole = 'manager'
  round = 3
  role parameter in API = 'manager'
```

---

## Backend API Orchestration

### Orchestrator Pattern

All interview actions route through: `POST /api/interview/orchestrate`

```
Request Structure:
{
  action: 'greet' | 'question' | 'evaluate',
  role: 'hr' | 'expert' | 'manager',
  round: 1 | 2 | 3,
  ... (action-specific fields)
}
```

### Action 1: GREET

```typescript
POST /api/interview/orchestrate

Request:
{
  action: 'greet',
  role: 'hr',
  resumeData: {
    name: 'John Doe',
    domain: 'software',
    skills: ['React', 'Node.js'],
    ...
  },
  domain: 'software'
}

Process:
1. Generate contextual greeting
2. Address candidate by name
3. Set interviewer tone appropriate to role

Response:
{
  text: "Hello John, I'm Mira Sharma from HR. 
         In this round, we'll focus on communication, 
         attitude and workplace behavior. Let's begin.",
  meta: {
    role: 'hr',
    status: 'greet'
  }
}

Error Handling:
├─ 429: Quota exceeded → Fallback greeting
├─ 410: Endpoint removed → Hardcoded template
├─ 500: Server error → Default greeting

Fallback Greeting Template:
{
  hr: `Hello ${name}, I'm Mira Sharma from HR. 
       In this round, we'll focus on communication, 
       attitude and workplace behavior. Let's begin`,
  expert: `Hi ${name}, I'm Ashish Yadav, Domain Expert. 
           I'll be evaluating your problem-solving 
           approach and technical fundamentals. Ready?`,
  manager: `Good to meet you ${name}, I'm Ryan Bhardwaj, 
            Hiring Manager. This round focuses on leadership, 
            ownership and past experience. Let's proceed.`
}
```

### Action 2: QUESTION

```typescript
POST /api/interview/orchestrate

Request:
{
  action: 'question',
  role: 'expert',
  round: 2,
  questionNum: 3,
  previousQuestions: [
    'Question 1 text',
    'Question 2 text'
  ],
  resumeData: {
    name: 'John Doe',
    skills: ['React', 'Node.js', 'Python'],
    domain: 'software',
    experience: [...],
    ...
  },
  questionsPerRound: 5,
  domain: 'software'
}

Process (in generateInterviewQuestion):
├─ 1. Map domain to detailed description
│  (Software → Full-stack, Frontend, Backend, etc.)
│
├─ 2. Build system prompt with:
│  ├─ Candidate resume context
│  ├─ Domain details
│  ├─ Interview role & round
│  ├─ Experience level (junior/mid/senior)
│  └─ Previous questions to avoid repetition
│
├─ 3. Select round-specific API key:
│  ├─ Round 1 → GROQ_API_ROUND_1
│  ├─ Round 2 → GROQ_API_ROUND_2
│  └─ Round 3 → GROQ_API_ROUND_3
│
└─ 4. Call Groq Llama API
   ├─ Model: llama-3.3-70b-versatile
   ├─ Prompt: Generated system + user prompt
   └─ Temperature: Controlled (0.7)

Response:
{
  text: "Walk me through how you would design 
         a real-time notification system for a 
         social media platform. Consider scalability, 
         latency, and reliability.",
  meta: {
    question_complete: "3/5",
    role: 'expert',
    status: 'question'
  }
}

Error Handling:
├─ 429: Quota exceeded → Use fallback question
├─ 410: Endpoint removed → Hardcoded questions
└─ Response timeout → Retry or fallback

HR Round 1 Special Case:
└─ Always generates "Tell me about yourself"
   as first question for consistency
```

### Action 3: EVALUATE (Answer + Feedback)

```typescript
POST /api/interview/orchestrate

Request:
{
  action: 'evaluate',
  role: 'expert',
  round: 2,
  question: 'Design a notification system...',
  answer: 'I would use a pub-sub architecture...',
  completedCount: 3,
  questionsPerRound: 5,
  sessionId: 'uuid'
}

Process (in evaluateInterviewAnswer):
├─ 1. Format evaluation prompt
│  ├─ Include: Question + Answer
│  ├─ Ask for: JSON evaluation + feedback
│  └─ Metrics: Clarity, Relevance, Completeness, Confidence
│
├─ 2. Select round-specific API key
│
├─ 3. Call Groq Llama API
│  ├─ Request: Evaluate and provide structured feedback
│  └─ Response: JSON with scores + feedback text
│
└─ 4. Parse JSON response
   ├─ Extract: clarity, relevance, completeness, confidence
   ├─ Extract: feedback text
   └─ Calculate: average_score

Response:
{
  text: "Good architecture thinking! 
         You've covered scalability well. 
         Next time, also discuss failure recovery.",
  meta: {
    improvement_is: "Feedback text",
    interview_complete: false,
    question_complete: "3/5"
  },
  evaluation: {
    clarity: 85,
    relevance: 88,
    completeness: 78,
    confidence: 82,
    feedback: "Architecture sound, consider failure modes"
  }
}

Round Evaluation (Last Question):
When completedCount >= questionsPerRound:
├─ Aggregates all answers in session
├─ Calls evaluate with no question/answer
├─ Returns: Overall round score + improvement tips
└─ Example response:
{
  evaluation: {
    overallScore: 82,
    clarity: 83,
    technicalDepth: 80,
    improvementTips: [
      'Add more real-world examples',
      'Discuss tradeoffs in solutions'
    ]
  }
}
```

### Quota Management

```
Round-Specific API Keys:
├─ Each round gets own Groq API key
├─ Prevents one round quota exhaustion from blocking others
└─ Spreads usage across 3 keys

Error Code 429 (Quota Exceeded):
├─ Detected: res.status === 429
├─ Response has: { message, retryAfter }
├─ Action: Show error banner with retry time
├─ Fallback: Use hardcoded questions instead
└─ User can retry after retryAfter seconds

Key Rotation Pattern:
Round 1 → GROQ_API_ROUND_1
Round 2 → GROQ_API_ROUND_2
Round 3 → GROQ_API_ROUND_3
(No automatic switching; each round uses its own)
```

---

## Audio & Speech Processing

### Microphone Access Flow

```typescript
startRecording()
  ├─ 1. Request permission
  │  └─ navigator.mediaDevices.getUserMedia({ audio: true })
  │
  ├─ 2. Create MediaRecorder
  │  ├─ Input: audio stream
  │  └─ Purpose: Collect audio blobs (optional, mainly for upload)
  │
  ├─ 3. Start Web Speech Recognition
  │  └─ Browser Speech API (Chrome, Edge, Safari)
  │
  └─ 4. Update UI
     ├─ setIsRecording(true)
     ├─ setPhase('LISTENING')
     └─ setVideoUrl(listening.mp4)

Fallback:
If user denies microphone access:
  └─ alert("Please allow microphone access")
```

### Speech Recognition Details

```typescript
const SpeechRecognition = window.SpeechRecognition 
                       || window.webkitSpeechRecognition

rec.lang = 'en-IN'              // Indian English variant
rec.continuous = true           // Keep listening
rec.interimResults = true       // Show live text

Callbacks:

onstart():
  └─ speechStarted = false
  └─ setTimeout(() => abort if no speech, 15000)

onresult(event):
  ├─ Iterate event.results
  ├─ If isFinal → add to currentAnswer
  ├─ If interim → show preview text
  └─ resetSilenceTimer()

onerror(event):
  ├─ Handle network errors
  ├─ Handle no-speech errors
  ├─ Auto-retry after 2s
  └─ Show error banner

onend():
  └─ Auto-restart if still recording
```

### Silence Detection & Auto-Submit

```
Timeline:
├─ 0s: User starts speaking
│      → currentAnswer updated in real-time
│      → Transcript panel updates
│
├─ User stops speaking
│      → No speech detected for 6 seconds
│
├─ 6s: Silence detected
│      → setSilenceDetected(true)
│      → Show "silence detected" indicator
│      → Start countdown timer
│
├─ 3s Countdown: 3 → 2 → 1 → 0
│      → setSilenceCountdown(sec)
│      → User can SPEAK to reset
│         (interrupt silence detection)
│
├─ Countdown = 0
│      → setIsMuted(true)
│      → Disable microphone track
│      → Stop speech recognition
│      → Call submitAnswer()
│
└─ submitAnswer()
   └─ POST /api/interview/orchestrate
      └─ Groq evaluates answer
```

### Answer Submission

```typescript
submitAnswer()
  ├─ 1. Verify answer exists
  │  └─ if (!currentAnswer.trim()) nextQuestion()
  │
  ├─ 2. POST evaluation request
  │  POST /api/interview/orchestrate
  │  {
  │    action: 'evaluate',
  │    role, round, question, answer,
  │    completedCount, questionsPerRound, sessionId
  │  }
  │
  ├─ 3. Parse response
  │  └─ Extract: feedback, improvement tips
  │
  ├─ 4. Show feedback phase
  │  ├─ setPhase('FEEDBACK')
  │  ├─ speak(feedback)
  │  └─ setTimeout → 3000ms
  │
  └─ 5. Next action
     ├─ If not last question → fetchQuestion(next)
     └─ If last question → evaluateRound()
```

---

## Evaluation & Scoring

### Single Answer Evaluation

```
Groq evaluates on 4 metrics (0-100 scale):

1. CLARITY ─────────────────────────────
   └─ How clear, articulate, well-structured?
      • Good: Clear sentence structure, easy to follow
      • Bad: Rambling, unclear, hard to understand
      • Score: 85/100

2. RELEVANCE ───────────────────────────
   └─ How relevant to the question?
      • Good: Directly answers question asked
      • Bad: Tangential, off-topic
      • Score: 78/100

3. COMPLETENESS ────────────────────────
   └─ How thorough/complete?
      • Good: Covers main points, includes examples
      • Bad: Shallow, missing key details
      • Score: 82/100

4. CONFIDENCE ──────────────────────────
   └─ How confident in the answer?
      • Good: Clear, decisive language
      • Bad: Hesitant, uncertain tone
      • Score: 80/100

AVERAGE SCORE = (85 + 78 + 82 + 80) / 4 = 81.25
```

### Round Evaluation

```
After completing all questions in a round:

GET round evaluation data
├─ Session contains all Q&A pairs
├─ Groq generates round-level assessment
└─ Metrics:
   ├─ Overall score (0-100)
   ├─ Aggregated clarity score
   ├─ Aggregated relevance score
   ├─ Round-specific strengths
   └─ Improvement tips (personalized)

Response Example:
{
  evaluation: {
    overallScore: 81,
    clarity: 84,
    relevance: 79,
    completeness: 80,
    confidence: 81,
    improvementTips: [
      'Provide more real-world examples',
      'Be more specific about your role',
      'Add metrics/data to support claims',
      'Work on confidence in technical explanations'
    ]
  }
}

Displayed:
├─ In SUGGESTIONS phase
├─ Spoken aloud via Web Speech API
├─ Shown in left transcript panel
└─ Stored in roundScores state
```

### Final Interview Score

```
After Round 3 completion:

Calculate Final Score:
├─ Round 1 Score (HR) × Weight (0.25) = HR%
├─ Round 2 Score (Tech) × Weight (0.35) = Tech%
├─ Round 3 Score (Manager) × Weight (0.40) = Manager%
│
└─ FINAL SCORE = HR% + Tech% + Manager%
   └─ Range: 0-100
   └─ Example: 81

Display on Results Page:
├─ "Overall Score: 81/100"
├─ "Round 1 (HR): 78"
├─ "Round 2 (Tech): 85"
├─ "Round 3 (Manager): 79"
├─ Feedback for each round
└─ Download PDF report
```

---

## Session State Management

### State Variables

```typescript
// Interview Flow
const [phase, setPhase] = useState<Phase>('GREET')
  └─ Current phase: GREET, QUESTION, LISTENING, FEEDBACK, SUGGESTIONS, EVALUATING, BREAK, COMPLETE

const [currentRole, setCurrentRole] = useState<Role>('hr')
  └─ Current interviewer: hr, expert, manager

const [round, setRound] = useState(1)
  └─ Current round: 1, 2, 3

const [questionCount, setQuestionCount] = useState(1)
  └─ Questions asked in current round: 1 - questionsPerRound

// Questions & Answers
const [currentQuestion, setCurrentQuestion] = useState(null)
  └─ { id, text, round }

const [transcript, setTranscript] = useState([])
  └─ Array of { type: 'question'|'answer', text: string }

// Recording & Speech
const [isRecording, setIsRecording] = useState(false)
  └─ Microphone active?

const [silenceDetected, setSilenceDetected] = useState(false)
  └─ User stopped speaking for 6s?

const [silenceCountdown, setSilenceCountdown] = useState(null)
  └─ Countdown timer (3, 2, 1, 0) or null

const [isMuted, setIsMuted] = useState(false)
  └─ Microphone disabled after auto-submit?

// Feedback & Results
const [feedbackText, setFeedbackText] = useState(null)
  └─ Feedback for current answer

const [suggestionsText, setSuggestionsText] = useState(null)
  └─ Round improvement tips

const [roundEvaluation, setRoundEvaluation] = useState(null)
  └─ Round scores & metrics

// Timers
const [breakTimer, setBreakTimer] = useState(null)
  └─ 30-second countdown between rounds

// Settings
const [questionsPerRound, setQuestionsPerRound] = useState(5)
  └─ User-selected questions count

// Error Handling
const [error, setError] = useState(null)
  └─ { message, retryAfter? }
```

### Refs for Performance

```typescript
// Recording & Speech Recognition
const recorderRef = useRef<MediaRecorder>()
const recognitionRef = useRef<SpeechRecognition>()
const streamRef = useRef<MediaStream>()

// Timers (prevent memory leaks)
const silenceTimerRef = useRef<NodeJS.Timeout>()
const countdownRef = useRef<NodeJS.Timeout>()
const breakTimerRef = useRef<NodeJS.Timeout>()

// Answer Tracking
const currentAnswer = useRef('')
const audioChunksRef = useRef<Blob[]>([])
const hasSpoken = useRef(false)

// Control Flow
const isFetchingQuestionRef = useRef(false)
  └─ Prevents duplicate question fetches

const lastActivityRef = useRef<number>()
  └─ Track last user activity for silence detection
```

### Cleanup Function

```typescript
cleanup() → called on phase changes, unmount, answer submit
  ├─ Stop MediaRecorder
  ├─ Stop audio stream tracks
  ├─ Stop speech recognition
  ├─ Clear all timers
  │  ├─ silenceTimerRef
  │  ├─ countdownRef
  │  └─ breakTimerRef
  ├─ Cancel speech synthesis
  ├─ Revoke object URLs
  └─ Reset refs to initial state
```

### Session Lifecycle

```
NEW SESSION:
1. /interview/setup
   └─ POST /api/interview/session/create
      └─ DB: Insert new session (status: 'active')

2. /interview/room?sessionId=...
   └─ GET /api/interview/session
      └─ Fetch from DB: questions, answers, currentRound, etc.

3. Interview progresses
   └─ DB: Updated with each Q&A pair

4. Round complete
   └─ DB: Set status = 'paused'
   └─ OR proceed to next round (stays 'active')

5. All 3 rounds complete
   └─ DB: Set status = 'completed'
   └─ Redirect: /dashboard → Display results

PAUSE & RESUME:
├─ User leaves mid-interview
├─ Session status: 'paused'
├─ User returns with same sessionId
├─ GET /api/interview/session → Restore state
├─ currentPhase: 'BREAK'
├─ Transcript restored
├─ User clicks "Continue to Next Round"
└─ Resume from where they left off
```

---

## Summary Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│               COMPLETE INTERVIEW FLOW                    │
└──────────────────────────────────────────────────────────┘

USER STARTS
  ↓
LOGIN/SIGNUP
  ↓
SETUP PAGE (/interview/setup)
  ├─ Upload/Select Resume
  ├─ Choose Domain (Software, Data, etc.)
  ├─ Choose Experience (Junior/Mid/Senior)
  ├─ Set Questions Per Round (3-15)
  └─ Create Session → sessionId generated
  ↓
INTERVIEW ROOM (/interview/room?sessionId=...)
  ↓
┌─── ROUND 1: HR (Mira Sharma) ───┐
│ ├─ GREET (3-5s)                  │
│ ├─ Q1: QUESTION → LISTENING      │
│ ├─ FEEDBACK (5-8s)               │
│ ├─ Q2: QUESTION → LISTENING      │
│ ├─ FEEDBACK (5-8s)               │
│ ├─ ... (repeat for all Qs)       │
│ ├─ EVALUATING (2-5s)             │
│ ├─ SUGGESTIONS (10-15s)          │
│ └─ BREAK (30s countdown)         │
└──────────────────────────────────┘
  ↓
┌─── ROUND 2: Expert (Ashish) ───┐
│ ├─ GREET (3-5s)                 │
│ ├─ Q1: QUESTION → LISTENING     │
│ ├─ FEEDBACK (5-8s)              │
│ ├─ ... (repeat for all Qs)      │
│ ├─ EVALUATING (2-5s)            │
│ ├─ SUGGESTIONS (10-15s)         │
│ └─ BREAK (30s countdown)        │
└─────────────────────────────────┘
  ↓
┌─── ROUND 3: Manager (Ryan) ───┐
│ ├─ GREET (3-5s)                │
│ ├─ Q1: QUESTION → LISTENING    │
│ ├─ FEEDBACK (5-8s)             │
│ ├─ ... (repeat for all Qs)     │
│ ├─ EVALUATING (2-5s)           │
│ ├─ SUGGESTIONS (10-15s)        │
│ └─ BREAK (auto, then COMPLETE) │
└────────────────────────────────┘
  ↓
COMPLETE
  ↓
RESULTS PAGE (/dashboard)
  ├─ Round Scores (HR, Expert, Manager)
  ├─ Overall Score
  ├─ Feedback for each round
  ├─ Improvement suggestions
  └─ Download PDF
```

---

## Key Technologies Used

```
Frontend:
├─ React (Client Components)
├─ Next.js App Router
├─ Web Speech API (speech recognition)
├─ Web Speech Synthesis (text-to-speech)
├─ MediaRecorder API (audio capture)
└─ localStorage (session state backup)

Backend:
├─ Next.js API Routes (Server-side)
├─ Groq API (LLM for questions, evaluation, feedback)
├─ Database (Session, questions, answers storage)
└─ File handling (Resume parsing)

APIs:
├─ /api/interview/orchestrate (Main interview logic)
├─ /api/interview/session (Session management)
├─ /api/interview/parse-resume (Resume extraction)
├─ /api/interview/join (Session tracking)
└─ /api/interview/leave (Session cleanup)
```

---

**End of Document**
