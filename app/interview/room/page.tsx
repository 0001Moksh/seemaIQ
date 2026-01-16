"use client";
import { Mic, Sparkles, Volume2, Phone, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { audioQueue } from "@/lib/audio-queue";

type Phase = "GREET" | "QUESTION" | "LISTENING" | "FEEDBACK" | "SUGGESTIONS" | "EVALUATING" | "BREAK" | "COMPLETE";
type Role = "hr" | "expert" | "manager";

export default function InterviewRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading, user } = useAuth();
  const sessionId = searchParams.get("sessionId");

  const [phase, setPhase] = useState<Phase>("GREET");
  const [currentRole, setCurrentRole] = useState<Role>("hr");
  const [questionCount, setQuestionCount] = useState(1);
  const [round, setRound] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [suggestionsText, setSuggestionsText] = useState<string | null>(null);
  const [roundEvaluation, setRoundEvaluation] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<{ type: "question" | "answer"; text: string }[]>([]);
  const [questionReady, setQuestionReady] = useState(false);
  const [asideWidth, setAsideWidth] = useState<number>(384);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [breakTimer, setBreakTimer] = useState<number | null>(null);
  const [roundScores, setRoundScores] = useState<Record<number, number>>({});
  const [error, setError] = useState<{ message: string; retryAfter?: number } | null>(null);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [isOnline, setIsOnline] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [audioLevel, setAudioLevel] = useState(0);
  const isFetchingQuestionRef = useRef(false);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const userInitial = user?.name?.[0]?.toUpperCase() || "U";
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const desktopTranscriptRef = useRef<HTMLDivElement | null>(null);
  const mobileTranscriptRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(asideWidth);

  // Recording & recognition refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpoken = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAnswer = useRef("");
  const currentAudioUrl = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Network monitoring
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const checkNetworkQuality = async () => {
      if (!navigator.onLine) {
        setNetworkQuality('poor');
        return;
      }

      try {
        const start = Date.now();
        await fetch('/api/interview/session?ping=true', { method: 'HEAD' }).catch(() => { });
        const latency = Date.now() - start;

        if (latency < 200) setNetworkQuality('excellent');
        else if (latency < 500) setNetworkQuality('good');
        else setNetworkQuality('poor');
      } catch {
        setNetworkQuality('poor');
      }
    };

    updateOnlineStatus();
    checkNetworkQuality();

    const qualityInterval = setInterval(() => {
      // Stop checking if interview is complete
      if (phase === 'COMPLETE') return;
      checkNetworkQuality();
    }, 30000); // Check every 30 seconds instead of 5

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(qualityInterval);
    };
  }, [phase]);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.push("/auth/login");
    const init = async () => {
      if (!sessionId || !isLoggedIn) return
      try {
        const token = localStorage.getItem('authToken')
        const res = await fetch(`/api/interview/session?sessionId=${sessionId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) {
          startRound('hr')
          return
        }
        const data = await res.json()
        const sess = data.session
        if (sess?.status === 'paused') {
          // restore core state from session: role, currentRound, transcript and questions
          setCurrentRole(sess.role || 'hr')
          setRound(sess.currentRound || 1)
          setQuestionsPerRound(sess.questionsPerRound || 5)
          setPhase('BREAK')
          setGreetingText(null)
          // restore transcript from saved questions/answers
          const transcriptItems: any[] = []
          if (Array.isArray(sess.questions)) {
            sess.questions.forEach((q: any) => transcriptItems.push({ type: 'question', text: q.text }))
          }
          if (Array.isArray(sess.answers)) {
            sess.answers.forEach((a: any) => transcriptItems.push({ type: 'answer', text: a.text || a.userAnswer || '' }))
          }
          if (transcriptItems.length > 0) setTranscript(transcriptItems)
          // show paused state with no video
          setVideoUrl(null)
        } else {
          // active session: restore and continue
          setCurrentRole(sess.role || 'hr')
          setRound(sess.currentRound || 1)
          setQuestionsPerRound(sess.questionsPerRound || 5)
          // Restore transcript
          const transcriptItems: any[] = []
          if (Array.isArray(sess.questions)) {
            sess.questions.forEach((q: any) => transcriptItems.push({ type: 'question', text: q.text }))
          }
          if (Array.isArray(sess.answers)) {
            sess.answers.forEach((a: any) => transcriptItems.push({ type: 'answer', text: a.text || a.userAnswer || '' }))
          }
          if (transcriptItems.length > 0) setTranscript(transcriptItems)
          // If session has a pending question, fetch it
          startRound(sess?.role || 'hr')
        }
      } catch (err) {
        startRound('hr')
      }
    }

    init()
  }, [isLoading, isLoggedIn, sessionId]);

  useEffect(() => {
    // When newest message is at top, scroll container to top to show latest
    try {
      if (desktopTranscriptRef.current) desktopTranscriptRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { }
    try {
      if (mobileTranscriptRef.current) mobileTranscriptRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { }
  }, [transcript]);

  useEffect(() => {
    // mark presence when mounting and cleanup on unmount
    const joinSession = async () => {
      try {
        const token = localStorage.getItem('authToken')
        await fetch('/api/interview/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ sessionId }),
        })
      } catch (err) {
        // ignore
      }
    }

    joinSession()

    return () => {
      cleanup();
      if (currentAudioUrl.current) URL.revokeObjectURL(currentAudioUrl.current);
      try {
        const token = localStorage.getItem('authToken')
        fetch('/api/interview/leave', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ sessionId }),
        })
      } catch (err) {
        // ignore
      }
    };
  }, []);

  const cleanup = () => {
    // Clear audio queue to stop any pending speech
    audioQueue.clear();
    
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    recognitionRef.current?.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    window.speechSynthesis?.cancel();
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }
  };

  const getMaxQuestionsForRole = (role: Role): number => {
    return questionsPerRound;
  };

  const getVideoForPhase = (role: Role, p: Phase | string) => {
    switch (p) {
      case "GREET":
        return `/videos/${role}/greet.mp4`;
      case "QUESTION":
        return `/videos/${role}/question.mp4`;
      case "LISTENING":
        return `/videos/${role}/listening.mp4`;
      case "FEEDBACK":
      case "SUGGESTIONS":
      case "EVALUATING":
        return `/videos/${role}/conversation.mp4`;
      default:
        return null;
    }
  };

  const startRound = (role: Role) => {
    cleanup();
    setCurrentRole(role);
    setQuestionCount(1);
    setRound(role === "hr" ? 1 : role === "expert" ? 2 : 3);
    setPhase("GREET");
    setGreetingText(null);
    setVideoUrl(`/videos/${role}/greet.mp4`);
    setTranscript([]);
    setSilenceCountdown(null);
    hasSpoken.current = false;
    currentAnswer.current = "";
    audioChunksRef.current = [];

    setTimeout(() => fetchGreeting(role), 500);
  };

  const speak = async (text: string, role: Role, p?: Phase) => {
    if (!text.trim()) return Promise.resolve();
    
    try {
      setIsSpeaking(true);
      const phaseToUse = p ?? phase;
      const v = getVideoForPhase(role, phaseToUse);
      if (v) setVideoUrl(v);
      
      // Use audio queue instead of direct speech synthesis to prevent interruptions
      await audioQueue.speak(text, 'en-US', 1.2);
      
      setIsSpeaking(false);
      
      // Mark question ready and switch to listening phase when question completes
      if (phaseToUse === 'QUESTION') {
        setQuestionReady(true);
        setPhase('LISTENING');
        // Activate listening video immediately after question completes
        const listeningVideo = getVideoForPhase(role, 'LISTENING');
        if (listeningVideo) setVideoUrl(listeningVideo);
      } else if (phaseToUse !== 'LISTENING') {
        // Hide interviewer video after speaking for other phases
        setVideoUrl(null);
      }
    } catch (err) {
      console.error('Speech error:', err);
      setIsSpeaking(false);
      
      // Ensure question ready even on error
      if ((p ?? phase) === 'QUESTION') {
        setQuestionReady(true);
        setPhase('LISTENING');
        // Activate listening video even on error
        const listeningVideo = getVideoForPhase(role, 'LISTENING');
        if (listeningVideo) setVideoUrl(listeningVideo);
      } else if ((p ?? phase) !== 'LISTENING') {
        setVideoUrl(null);
      }
    }
  };

  const fetchGreeting = async (roleArg?: Role) => {
    try {
      const roleToUse = roleArg ?? currentRole;
      const token = localStorage.getItem("authToken");
      const domain = (window as any).__SESSION?.resumeData?.domain;
      const res = await fetch("/api/interview/orchestrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "greet", role: roleToUse, resumeData: (window as any).__SESSION?.resumeData || {}, domain }),
      });

      // Handle Gemini quota exceeded (429)
      if (res.status === 429) {
        const errorData = await res.json().catch(() => ({}))
        setError({
          message: errorData.message || "API quota exceeded. Please try again in a moment.",
          retryAfter: errorData.retryAfter
        })
        setGreetingText(null)
        setPhase("GREET")
        setVideoUrl(`/videos/${roleToUse}/greet.mp4`)
        return
      }

      if (res.status === 410) {
        // fallback to local template greeting
        const candidateName = (window as any).__SESSION?.resumeData?.name?.split(" ")[0] || "there";
        const templates: Record<string, string> = {
          hr: `Hello ${candidateName}, I’m Mira Sharma from HR. In this round, we’ll focus on communication, attitude and workplace behavior. Let’s begin`,
          expert: `Hi ${candidateName}, I’m Ashish Yadav, Domain Expert. I’ll be evaluating your problem-solving approach and your technical fundamentals. Ready to start?`,
          manager: `Good to meet you ${candidateName}, I’m Ryan Bhardwaj, Hiring Manager. This round focuses on leadership, ownership and past experience. Let’s proceed.`,
        };
        const greeting = templates[roleToUse] || `Hello ${candidateName}, let's begin.`;
        setGreetingText(greeting);
        setPhase("GREET");
        setVideoUrl(`/videos/${roleToUse}/greet.mp4`);
        speak(greeting, roleToUse, 'GREET').catch(() => { });
        setTimeout(() => fetchQuestion(1, roleToUse), 2500);
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch greeting")
      const json = await res.json()
      setError(null) // clear any previous error
      const text = json.text || json?.meta?.text || ''
      setGreetingText(text)
      setPhase('GREET')
      setVideoUrl(`/videos/${roleToUse}/greet.mp4`)
      speak(text, roleToUse, 'GREET').catch(() => { })
      setTimeout(() => {
        if (!isFetchingQuestionRef.current) fetchQuestion(1, roleToUse)
      }, 1200)
    } catch (err) {
      // fallback: proceed to question
      setError({ message: "We hit a temporary error. Moving ahead to the question." })
      setTimeout(() => fetchQuestion(1, roleArg), 1000)
    }
  };

  const replayQuestion = async () => {
    if (currentQuestion) {
      setQuestionReady(false);
      setPhase('QUESTION');
      setVideoUrl(`/videos/${currentRole}/question.mp4`);
      speak(currentQuestion.text, currentRole, 'QUESTION')
        .then(() => {
          setQuestionReady(true);
          setPhase('LISTENING');
        })
        .catch(() => {
          setQuestionReady(true);
          setPhase('LISTENING');
        });
    }
  };

  const fetchQuestion = async (num: number, roleArg?: Role) => {
    try {
      if (isFetchingQuestionRef.current) return;
      isFetchingQuestionRef.current = true;
      setQuestionReady(false);
      const token = localStorage.getItem("authToken");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const domain = (window as any).__SESSION?.resumeData?.domain;
      // Use orchestrator to get question
      const roleToUse = roleArg ?? currentRole;
      const prevQuestions = transcript.filter(t => t.type === 'question').map(q => q.text)
      const res = await fetch(`/api/interview/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'question', role: roleToUse, round, questionNum: num, previousQuestions: prevQuestions, resumeData: (window as any).__SESSION?.resumeData || {}, questionsPerRound: getMaxQuestionsForRole(roleToUse), domain })
      })

      // Handle Gemini quota exceeded (429)
      if (res.status === 429) {
        const errorData = await res.json().catch(() => ({}))
        setError({
          message: errorData.message || "API quota exceeded. Please try again in a moment.",
          retryAfter: errorData.retryAfter
        })
        setQuestionReady(true)
        return
      }

      if (res.status === 410) {
        // endpoint removed — show fallback error question
        setPhase('QUESTION')
        setCurrentQuestion({ id: 'error', text: 'Questions are currently unavailable. Please try later.', round })
        setQuestionReady(true)
        return
      }

      if (!res.ok) throw new Error('Failed to load question')
      const data = await res.json()
      setError(null) // Clear any previous errors
      const qText = data.text || data?.question || ''
      const question = { id: `orchestrator-${num}`, text: qText, round }
      setCurrentQuestion(question)
      setTranscript(prev => {
        const last = prev[prev.length - 1]
        if (last && last.type === 'question' && last.text === question.text) return prev
        return [...prev, { type: 'question', text: question.text }]
      })
      setPhase('QUESTION')
      setGreetingText(null)
      setFeedbackText(null)
      setVideoUrl(`/videos/${roleToUse}/question.mp4`)
      speak(question.text, roleToUse, 'QUESTION')
        .then(() => setQuestionReady(true))
        .catch(() => setQuestionReady(true))
      setTimeout(() => setQuestionReady(true), 12000)
    } catch (err) {
      setPhase("QUESTION");
      setCurrentQuestion({ id: "error", text: "Failed to load question. Please refresh.", round });
      setQuestionReady(true);
    } finally {
      isFetchingQuestionRef.current = false;
    }
  };

  const fetchFeedback = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/interview/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'evaluate', role: currentRole, round, question: currentQuestion?.text, answer: currentAnswer.current, completedCount: questionCount, questionsPerRound: getMaxQuestionsForRole(currentRole), sessionId }),
      })

      if (res.status === 410) {
        // removed — skip feedback
        const maxQuestions = getMaxQuestionsForRole(currentRole)
        if (questionCount < maxQuestions) {
          setQuestionCount(prev => prev + 1)
          fetchQuestion(questionCount + 1)
        } else {
          evaluateRound()
        }
        return
      }

      if (!res.ok) throw new Error('Failed to get feedback')
      const data = await res.json()
      const feedback = data.text || data?.meta?.improvement_is || (data.evaluation?.feedback) || 'Good.'
      setFeedbackText(feedback)
      setPhase('FEEDBACK')
      setVideoUrl(`/videos/${currentRole}/conversation.mp4`)
      await speak(feedback, currentRole, 'FEEDBACK').catch(() => { })
      setFeedbackText(null)
      const maxQuestions = getMaxQuestionsForRole(currentRole)
      if (questionCount < maxQuestions) {
        setQuestionCount(prev => prev + 1)
        fetchQuestion(questionCount + 1)
      } else {
        evaluateRound()
      }
    } catch (err) {
      setQuestionCount(prev => prev + 1)
      setTimeout(() => fetchQuestion(questionCount + 1), 1500)
    }
  };

  const fetchSuggestions = async () => {
    try {
      const token = localStorage.getItem("authToken");
      // Use orchestrator evaluate to get round evaluation and suggestions
      const evalRes = await fetch('/api/interview/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'evaluate', role: currentRole, round, sessionId, completedCount: questionCount, questionsPerRound: getMaxQuestionsForRole(currentRole) }),
      })

      if (evalRes.status === 410) {
        setPhase('BREAK')
        return
      }

      if (!evalRes.ok) throw new Error('Eval failed')
      const evalJson = await evalRes.json()
      setRoundEvaluation(evalJson.evaluation || evalJson)
      setPhase('EVALUATING')
      setVideoUrl(`/videos/${currentRole}/conversation.mp4`)

      const suggestions = evalJson.evaluation?.improvementTips || evalJson.meta?.improvement_is || evalJson.improvement_is || (Array.isArray(evalJson.improvement) ? evalJson.improvement.join('. ') : '') || 'Continue practicing and refining your answers.'
      setSuggestionsText(Array.isArray(suggestions) ? suggestions.join(' ') : suggestions)
      setPhase('SUGGESTIONS')
      setVideoUrl(`/videos/${currentRole}/conversation.mp4`)
      await speak(typeof suggestions === 'string' ? suggestions : suggestions.join(' '), currentRole, 'SUGGESTIONS').catch(() => { })
      setSuggestionsText(null)
      setPhase('BREAK')
    } catch (err) {
      setPhase("BREAK");
    }
  };

  const startRecording = async () => {
    try {
      cleanup();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.start();
      setIsRecording(true);
      setVideoUrl(`/videos/${currentRole}/listening.mp4`);
      setPhase("LISTENING");
      currentAnswer.current = "";
      hasSpoken.current = false;
      setSilenceCountdown(null);
      setSilenceDetected(false);
      setIsMuted(false);
      lastActivityRef.current = Date.now();
      setTranscript(prev => [...prev, { type: "answer", text: "" }]);

      // Setup audio visualization
      setupAudioAnalyzer(stream);

      startSpeechRecognition();
    } catch {
      alert("Please allow microphone access");
    }
  };

  const setupAudioAnalyzer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.5;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Focus on voice frequency range (85 Hz to 255 Hz - typical human speech)
        const startBin = Math.floor((85 / 22050) * bufferLength);
        const endBin = Math.floor((2000 / 22050) * bufferLength);

        let sum = 0;
        let count = 0;
        for (let i = startBin; i < endBin && i < bufferLength; i++) {
          sum += dataArray[i];
          count++;
        }

        const average = count > 0 ? sum / count : 0;

        // Normalize to 0-100 range with better sensitivity
        const normalized = Math.min(100, Math.max(0, (average / 255) * 150));

        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (err) {
      console.error("Audio analyser error:", err);
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech Recognition not supported");

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    let speechStarted = false;
    let timeoutId: NodeJS.Timeout | null = null;

    rec.onstart = () => {
      speechStarted = false;
      // Set timeout to abort if no speech detected within 15 seconds
      timeoutId = setTimeout(() => {
        if (!speechStarted && rec) {
          rec.abort();
          console.warn("Speech recognition timeout: no audio detected, aborting");
        }
      }, 15000);
    };

    rec.onresult = (e: any) => {
      // Mark that speech has started
      if (!speechStarted) {
        speechStarted = true;
        if (timeoutId) clearTimeout(timeoutId);
      }

      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) final += t + " ";
        else interim = t;
      }

      if (final) {
        currentAnswer.current += final;
        hasSpoken.current = true;
        updateLastAnswer(currentAnswer.current);

        // If user speaks during countdown, interrupt and restart timer
        if (silenceCountdown !== null) {
          setSilenceCountdown(null);
          setSilenceDetected(false);
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
        }

        resetSilenceTimer();
      }
      if (interim && hasSpoken.current) {
        updateLastAnswer(currentAnswer.current + interim);
      }
    };

    rec.onerror = (e: any) => {
      if (timeoutId) clearTimeout(timeoutId);

      const errorMessages: { [key: string]: string } = {
        "no-speech": "No speech detected. Ensure your microphone is working and not muted.",
        "audio-capture": "Microphone not found or permission denied. Check browser settings.",
        "network": "Network error occurred. Check your connection.",
        "aborted": "Speech recognition was interrupted.",
        "service-not-allowed": "Speech recognition service unavailable.",
      };

      const errorMsg = errorMessages[e.error] || `Speech error: ${e.error}`;
      console.error("Speech recognition error:", e.error, "-", errorMsg);

      // For transient errors, auto-retry after a short delay
      if (["no-speech", "audio-capture"].includes(e.error) && isRecording) {
        console.warn("Auto-retrying speech recognition...");
        setError({ message: errorMsg, retryAfter: 2 });
        setTimeout(() => {
          if (isRecording && recognitionRef.current !== rec) {
            startSpeechRecognition();
          }
        }, 2000);
      }
    };

    rec.onend = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // If still recording but recognition ended, attempt to restart
      if (isRecording && !hasSpoken.current && recognitionRef.current === rec) {
        console.log("Speech recognition ended without speech, restarting...");
        setTimeout(() => {
          if (isRecording) {
            startSpeechRecognition();
          }
        }, 1000);
      }
    };

    rec.start();
  };

  const updateLastAnswer = (text: string) => {
    setTranscript(prev => {
      const copy = [...prev];
      if (copy.length > 0 && copy[copy.length - 1].type === "answer") {
        copy[copy.length - 1].text = text;
      }
      return copy;
    });
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setSilenceCountdown(null);
    setSilenceDetected(false);
    setIsMuted(false);
    lastActivityRef.current = Date.now();

    if (!hasSpoken.current) return;

    // Step 1: Wait for 6 seconds of silence before showing countdown
    silenceTimerRef.current = setTimeout(() => {
      // User has been silent for 6 seconds, show detection but DON'T mute yet
      setSilenceDetected(true);

      // Step 2: Start countdown to auto-submit (user can still speak during this)
      let sec = 3;
      setSilenceCountdown(sec);
      countdownRef.current = setInterval(() => {
        sec--;
        setSilenceCountdown(sec);
        if (sec <= 0) {
          clearInterval(countdownRef.current!);
          // NOW mute and submit
          setIsMuted(true);

          // Disable microphone input from browser
          if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => {
              track.enabled = false;
            });
          }

          // Stop speech recognition
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }

          submitAnswer();
        }
      }, 1000);
    }, 6000);
  };

  const submitAnswer = async () => {
    cleanup();
    setIsRecording(false);
    setSilenceCountdown(null);

    if (!currentQuestion || !currentAnswer.current.trim()) {
      nextQuestionOrRound();
      return;
    }

    // Send to orchestrator for evaluation (no server-side audio handling)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/interview/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'evaluate', role: currentRole, round, question: currentQuestion.text, answer: currentAnswer.current, completedCount: questionCount, questionsPerRound: getMaxQuestionsForRole(currentRole), sessionId }),
      })

      // Handle Gemini quota exceeded (429)
      if (res.status === 429) {
        const errorData = await res.json().catch(() => ({}))
        setError({
          message: errorData.message || "API quota exceeded. Please try again in a moment.",
          retryAfter: errorData.retryAfter
        })
        return
      }

      if (res.status === 410) {
        // endpoint removed — advance locally through remaining questions
        const maxQuestions = getMaxQuestionsForRole(currentRole)
        if (questionCount < maxQuestions) {
          setQuestionCount(prev => prev + 1)
          setTimeout(() => fetchQuestion(questionCount + 1), 1200)
        } else {
          evaluateRound()
        }
        return
      }

      if (!res.ok) throw new Error('Failed to submit answer')
      const data = await res.json()
      setError(null)
      const maxQuestions = getMaxQuestionsForRole(currentRole)
      if (questionCount >= maxQuestions) {
        setPhase('EVALUATING')
      }
      // use feedback from orchestration
      if (data.text || data.meta?.improvement_is || data.evaluation) {
        const feedbackToShow = data.text || data.meta?.improvement_is || (data.evaluation?.feedback || '')
        setFeedbackText(feedbackToShow)
        setPhase('FEEDBACK')
        await speak(feedbackToShow, currentRole, 'FEEDBACK').catch(() => { })
        // Clear feedback after speech ends, then move to next question
        setTimeout(() => {
          setFeedbackText(null)
          const maxQuestions = getMaxQuestionsForRole(currentRole)
          if (questionCount < maxQuestions) {
            setQuestionCount(prev => prev + 1)
            setTimeout(() => fetchQuestion(questionCount + 1), 1200)
          } else {
            evaluateRound()
          }
        }, 3000)
        return
      }
    } catch (err) {
      // ignore and continue
    }

    const maxQuestions = getMaxQuestionsForRole(currentRole);
    if (questionCount < maxQuestions) {
      setQuestionCount(prev => prev + 1);
      setTimeout(() => fetchQuestion(questionCount + 1), 1200);
    } else {
      evaluateRound();
    }
  };

  const nextQuestionOrRound = () => {
    const maxQuestions = getMaxQuestionsForRole(currentRole);
    if (questionCount < maxQuestions) {
      setQuestionCount(prev => prev + 1);
      setTimeout(() => fetchQuestion(questionCount + 1), 1500);
    } else {
      evaluateRound();
    }
  };

  const evaluateRound = () => {
    setPhase("EVALUATING");
    // run evaluation + suggestions then go to break
    setTimeout(async () => {
      try {
        await fetchSuggestions();
      } catch (e) {
        // ignore
      }
      setPhase("BREAK");
      // Start 30-second countdown
      setBreakTimer(30);
      if (breakTimerRef.current) clearTimeout(breakTimerRef.current);
      breakTimerRef.current = setInterval(() => {
        setBreakTimer(prev => {
          if (prev === null || prev <= 1) {
            if (breakTimerRef.current) clearInterval(breakTimerRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }, 800);
  };

  const moveToNextRound = () => {
    const nextRoleMap: Record<Role, Role> = { hr: "expert", expert: "manager", manager: "hr" };
    const nextRole = nextRoleMap[currentRole];
    const nextRound = round + 1;

    if (nextRound > 3) {
      // All rounds complete, send email and go to results
      setPhase("COMPLETE");

      // Send completion email
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

      setTimeout(() => router.push(`/results/${sessionId}`), 2000);
      return;
    }

    // Reset for next round
    setQuestionCount(1);
    setRound(nextRound);
    setBreakTimer(null);
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    setRoundScores({});
    startRound(nextRole);
  };

  const handleVideoEnd = () => {
    if (phase === "GREET") fetchQuestion(1);
  };

  if (isLoading || !isLoggedIn || !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center liquid-bg">
        <Card className="p-10 text-center">
          <p className="text-lg font-semibold">Invalid Session</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Go Back</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen liquid-bg text-foreground flex flex-col">
      {error && (
        <div className="bg-red-500/20 text-red-100 px-4 py-3 text-sm flex items-center justify-between border-b border-red-500/30">
          <span>{error.message}{error.retryAfter ? ` (retry after ~${error.retryAfter}s)` : ""}</span>
          <button
            className="text-red-100 hover:text-red-50 underline text-xs ml-4"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}
      <header className="bg-black border-b border-border px-4 lg:px-6 py-3 lg:py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Network Indicator */}
          <div className="flex items-center gap-2 ml-auto lg:ml-4" title={isOnline ? `Network: ${networkQuality}` : 'Offline'}>
            {isOnline ? (
              <div className="flex items-center gap-1.5">
                <Wifi className={`w-6 h-6 lg:w-10 lg:h-10  ${networkQuality === 'excellent' ? 'text-green-500' :
                  networkQuality === 'good' ? 'text-yellow-500' :
                    'text-orange-500'
                  }`} />

              </div>
            ) : (
              <div className="flex items-center gap-5">
                <WifiOff className="w-8 h-8 lg:w-10 lg:h-10 text-red-500" />
                {/* <span className="hidden lg:inline text-xs text-red-500 font-medium">Offline</span> */}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm lg:text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent truncate">
              {currentRole.toUpperCase()} Round • Q{questionCount}/{getMaxQuestionsForRole(currentRole)}
            </h1>
            <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 lg:mt-1 truncate">
              {phase === 'GREET' ? 'Greeting…' : phase === 'QUESTION' ? 'Questioning…' : phase === 'LISTENING' ? 'Listening…' : phase === 'FEEDBACK' ? 'Feedback…' : phase === 'SUGGESTIONS' ? 'Suggestions…' : phase === 'EVALUATING' ? 'Evaluating…' : phase === 'BREAK' ? `Break (${breakTimer !== null ? breakTimer + 's remaining' : 'Ready'})` : phase === 'COMPLETE' ? 'Complete' : ''}
            </p>
          </div>


        </div>
        {/* <div>
          {phase === 'BREAK' && !videoUrl && (
            <div className="flex flex-col gap-3">
              {breakTimer !== null && (
                <div className="text-sm text-orange-500 font-semibold text-center">
                  Continue in {breakTimer}s
                </div>
              )}
              <Button
                size="sm"
                onClick={moveToNextRound}
                disabled={breakTimer !== null && breakTimer > 0}
                className={`transition-all ${breakTimer === null || breakTimer === 0 ? 'opacity-100' : 'opacity-50 cursor-not-allowed'}`}
              >
                {round >= 3 ? 'Complete Interview' : 'Continue to Next Round'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken')
                    await fetch('/api/interview/pause', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token && { Authorization: `Bearer ${token}` }),
                      },
                      body: JSON.stringify({ sessionId, action: 'pause', currentRound: round, questionIndex: questionCount }),
                    })
                  } catch (err) {
                    console.error('Failed to pause session', err)
                  }
                  router.push('/dashboard')
                }}
              >
                Leave Interview
              </Button>
            </div>
          )}
        </div> */}

      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-6 relative">
        <section className="flex-1 relative min-h-96 lg:min-h-full">

          <div className="relative h-96 border border-primary/50 lg:h-full bg-black shadow-2xl rounded-lg lg:rounded-2xl overflow-hidden">
            {/* Background Image - only show when video is playing */}
            {videoUrl && (
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(/videos/${currentRole}/bg.jpeg)` }}
              />
            )}
            
            {/* Video Overlay */}
            {videoUrl ? (
              <video
                key={videoUrl}
                src={videoUrl}
                autoPlay
                muted={true}
                loop
                playsInline
                onError={(e) => {
                  console.error('Video load error:', videoUrl);
                  // Retry loading video after 1 second
                  setTimeout(() => {
                    if (e.currentTarget) {
                      e.currentTarget.load();
                    }
                  }, 1000);
                }}
                onLoadedData={() => {
                  console.log('Video loaded successfully:', videoUrl);
                }}
                className="relative z-10 w-full h-full rounded-lg lg:rounded-2xl border-2 lg:border-[3px] border-primary object-cover shadow-2xl ring-1 ring-white/90 animate-in fade-in duration-500" />
            ) : (
              <div className="relative z-10 w-full h-full flex items-center justify-center text-white text-xl animate-in fade-in duration-300">
                <div className="flex flex-col items-center gap-4">
                  <img src={`/videos/${currentRole}/profile.png`} alt="Interviewer" className="w-36 h-36 rounded-full object-cover border-2 border-white/40 shadow-2xl" />
                  <p className="text-lg">{phase === 'BREAK' ? (breakTimer !== null && breakTimer > 0 ? `Break Time — Next Round in ${breakTimer}s` : 'Ready to continue? Click "Continue to Next Round"') : 'Loading...'}</p>
                </div>
              </div>
            )}

            {/* Overlays */}
            {/* {phase === "GREET" && greetingText && (
              <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-0">
                <div className="bg-black/20 backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs rounded-lg lg:rounded-2xl p-4 lg:p-8 max-w-5xl mx-auto border border-white/10 shadow-2xl">
                  <p className="text-base lg:text-2xl text-white leading-relaxed text-center animate-in fade-in">{greetingText}</p>
                </div>
              </div>
            )} */}
            <div className="absolute top-0 left-0 z-40 items-center">
              <div className="liquid-bg text-white/80 font-medium text-sm py-2 px-5 rounded-lg border border-primary/50 shadow-lg backdrop-blur-md">
                {
                  {
                    hr: "HR – Mira Sharma",
                    expert: "Expert – Ashish Yadav",
                    manager: "Manager – Ryan Bhardwaj"
                  }[currentRole?.toLowerCase()]
                  ?? currentRole?.toUpperCase()
                }

              </div>

            </div>

            {/* {phase === "QUESTION" && currentQuestion && (
              <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-0">
                <div className="bg-black/10 backdrop-blur-xs rounded-lg lg:rounded-2xl p-4 lg:p-8 max-w-5xl mx-auto border border-white/10 shadow-2xl">

                  <div className="flex items-start gap-2 lg:gap-3">
                    <p className="text-sm lg:text-lg text-white leading-relaxed flex-1">
                      {currentQuestion.text}
                    </p>

                    <div className="flex gap-2 flex-shrink-0 ml-auto">
                      {questionReady && !isSpeaking && (
                        <div className="relative group">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={replayQuestion}
                            title=""
                            className="
          p-2 rounded-xl border border-white/20 
          bg-black/50 backdrop-blur-md
          hover:bg-black/100 hover:border-white/40
          transition-all duration-300 shadow-md hover:shadow-xl
          flex items-center justify-center
        "
                          >
                            <Volume2
                              className="
            w-5 lg:w-6 h-5 lg:h-6 text-white/90 
            transition-all duration-300 group-hover:scale-110
          "
                            />
                          </Button>

                          <div
                            className="
          absolute -top-14 left-1/2 -translate-x-1/2
          bg-black text-white text-sm font-medium px-4 py-2.5
          rounded-xl shadow-xl backdrop-blur-md
          border border-white/40
          pointer-events-none
          opacity-0 group-hover:opacity-100
          scale-95 group-hover:scale-100
          transition-all duration-300 ease-out
        "
                          >
                            Repeat Question

                            <div
                              className="
            w-3 h-3 bg-black rotate-45 absolute 
            -bottom-[6px] left-1/2 -translate-x-1/2
            border-b border-r border-white/40
          "
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )} */}

            {phase === "FEEDBACK" && feedbackText && (
              <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-0">
                <div className="bg-black/20 backdrop-blur-xs rounded-lg lg:rounded-2xl p-4 lg:p-8 max-w-5xl mx-auto border border-white/10 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <p className="text-sm lg:text-lg text-white leading-relaxed animate-in fade-in flex-1">{feedbackText}</p>
                    <Volume2 className="w-5 lg:w-6 h-5 lg:h-6 text-white/80 ml-4 flex-shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {/* {phase === "EVALUATING" && roundEvaluation && (
              <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-0">
                <div className="bg-black/20 backdrop-blur-xs rounded-lg lg:rounded-2xl p-4 lg:p-8 max-w-5xl mx-auto border border-white/10 shadow-2xl">
                  <div className="mb-4">
                    <p className="text-sm lg:text-lg text-white font-semibold">Round Summary</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {roundEvaluation.scores && Object.entries(roundEvaluation.scores).map(([k, v]: any) => (
                      <div key={k} className="bg-black/10 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground uppercase">{k}</p>
                        <p className="text-lg text-white font-bold">{Math.round(v as number)}</p>
                      </div>
                    ))}
                  </div>
                  {roundEvaluation.improvementTips && (
                    <div className="text-sm text-white">
                      <p className="font-medium">Improvement Tips:</p>
                      <ul className="list-disc ml-5 mt-2">
                        {roundEvaluation.improvementTips.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )} */}

            {/* {phase === "SUGGESTIONS" && suggestionsText && (
              <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-0">
                <div className="bg-black/20 backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs rounded-lg lg:rounded-2xl p-4 lg:p-8 max-w-5xl mx-auto border border-white/10 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <p className="text-sm lg:text-2xl text-white leading-relaxed animate-in fade-in flex-1">{suggestionsText}</p>
                    <Volume2 className="w-5 lg:w-6 h-5 lg:h-6 text-white/80 ml-4 flex-shrink-0" />
                  </div>
                </div>
              </div>
            )} */}
          </div>
        </section>

        {/* Resizer - hidden on mobile */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            startXRef.current = e.clientX;
            startWidthRef.current = asideWidth;
            const onMouseMove = (ev: MouseEvent) => {
              const dx = startXRef.current - ev.clientX;
              const newWidth = Math.min(Math.max(startWidthRef.current + dx, 280), 720);
              setAsideWidth(newWidth);
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
          className="hidden lg:block w-1 cursor-col-resize bg-white/20 rounded my-2 transition-colors"
        />

        {/* Desktop Transcript Sidebar */}
        <aside style={{ width: asideWidth }} className="hidden lg:flex lg:flex-col gap-4">
          <Card className="flex flex-col shadow-lg border bg-card">
            <div className="flex px-10 border-border/80">
              <h3 className="font-bold text-lg text-foreground">Live Transcript</h3>
            </div>

            {/* Scrollable area with max-h-96 and professional custom scrollbar */}
            <div ref={desktopTranscriptRef} className="flex-1 overflow-y-auto p-2 space-y-6 max-h-105 custom-scrollbar-professional">
              {transcript.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground italic">
                  Questions & Answers will appear here...
                </p>
              ) : (
                // show latest messages at top
                [...transcript].reverse().map((item, i) => (
                  <div
                    key={i}
                    className={`flex gap-1 ${item.type === "answer" ? "flex-row-reverse" : ""} animate-in fade-in-50 duration-300`}
                  >
                    {item.type === "question" ? (
                      <img
                        src={`/videos/${currentRole}/profile.png`}
                        alt="Interviewer"
                        className="w-10 h-10 rounded-full object-cover border-2 border-white/50 shadow-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full border-2 border-white/50 bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center font-bold text-lg shadow-lg flex-shrink-0">
                        {userInitial}
                      </div>
                    )}

                    <div
                      className={`max-w-xs px-5 py-4 rounded-2xl ${item.type === "question"
                        ? "bg-primary/15 text-foreground"
                        : "bg-muted text-muted-foreground"
                        } shadow-sm`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {item.text || "..."}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
          {/* Clean & Professional Floating Control Bar */}
          <div className="fixed inset-0 pointer-events-none z-50">

            {/* Silence detected – countdown will start; user can interrupt by speaking */}
            {isRecording && silenceDetected && silenceCountdown === null && (
              <div className="absolute bottom-10 right-25 -translate-x-1/2 animate-in slide-in-from-top fade-in duration-500">
                <div className="bg-card backdrop-blur-xl border text-white px-3 py-2 rounded-2xl shadow-2xl">
                  <p className="text-sm font-bold opacity-100">Silence detected — countdown starting. Speak now to continue.</p>
                </div>
              </div>
            )}

            {/* Auto-Submit Countdown – user can still speak to cancel */}
            {isRecording && silenceCountdown !== null && (
              <div className="absolute bottom-10 right-25 -translate-x-1/2 animate-in slide-in-from-top fade-in duration-500">
                <div className="bg-card backdrop-blur-xl border text-white px-3 py-2 rounded-2xl shadow-2xl">
                  <p className="text-sm font-bold opacity-100">Auto-submitting in {silenceCountdown}s</p>
                </div>
              </div>
            )}

            {/* Muted state just before submit */}
            {isRecording && isMuted && (
              <div className="absolute bottom-10 right-25 -translate-x-1/2 animate-in slide-in-from-top fade-in duration-500">
                <div className="bg-red-700/90 backdrop-blur-xl border border-red-500 text-white px-3 py-2 rounded-2xl shadow-2xl">
                  <p className="text-sm font-bold opacity-100">🔇 Mic muted — submitting your answer</p>
                </div>
              </div>
            )}

            {/* Floating Controls – Bottom Right */}
            <div className="absolute bottom-20 lg:bottom-8 right-8 pointer-events-auto">
              <div className="flex items-center gap-5 liquid-bg border border-white/20 rounded-full p-4 shadow-2xl">

                {/* Show waiting message during question */}
                {phase === 'QUESTION' && (
                  <div className="px-6 py-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-white/90">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <span>Question being asked... Please wait</span>
                    </div>
                  </div>
                )}

                {/* Mic Button – Only show when in LISTENING phase */}
                {phase === 'LISTENING' && questionReady && (
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={!isRecording ? startRecording : undefined}
                    disabled={isRecording}
                    className={`
            relative w-12 h-12 rounded-full p-0 transition-all duration-300 group
            ${
                        isRecording
                          ? "bg-primary text-white shadow-2xl"
                          : "bg-white text-gray-900 hover:scale-105 shadow-xl"
                      }
                      `}
                  >
                    {/* Voice Visualization Bars - Show when recording */}
                    {isRecording && (
                      <div className="absolute -inset-4 flex items-center justify-center gap-1">
                        {[...Array(5)].map((_, i) => {
                          const phase = (Date.now() / 200 + i * 0.8) % (Math.PI * 2);
                          const wave = (Math.sin(phase) * 0.4 + 0.6);
                          const baseHeight = 6;
                          const maxHeight = 20;
                          const height = baseHeight + (wave * (audioLevel / 100) * maxHeight);
                          return (
                            <div
                              key={i}
                              className="w-1 bg-white ring-1 ring-white rounded-full"
                              style={{
                                height: `${Math.max(baseHeight, height)}px`,
                                opacity: 0.75 + (audioLevel / 400),
                                transition: 'height 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out',
                              }}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Tooltip – Only when ready & not recording */}
                    {!isRecording && (
                      <div className="absolute -top-0.6 right-0 -translate-x-1/2 pointer-events-none">
                        <div className="relative bg-black text-white text-sm font-medium px-4 py-2.5 
                  rounded-xl shadow-xl backdrop-blur-md animate-pulse
                  border border-white/40">

                          Turn On Your Mic

                          {/* Arrow */}
                          <div className="w-5 h-5 bg-black rotate-45 absolute bottom-[11px] -right-2 
                    border-t border-r border-white/40" />
                        </div>
                      </div>
                    )}

                    {/* Icon / REC Label */}
                    {isRecording ? (
                      <div className="relative z-10">
                      </div>
                    ) : (
                      <Mic className="w-20 h-20" />
                    )}
                  </Button>
                )}

                {/* End Interview Button */}
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={async () => {
                    try {
                      if (isRecording) {
                        await submitAnswer()
                      }

                      const token = localStorage.getItem('authToken')
                      await fetch('/api/interview/pause', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token && { Authorization: `Bearer ${token}` }),
                        },
                        body: JSON.stringify({ sessionId, action: 'pause', currentRound: round, questionIndex: questionCount }),
                      })
                    } catch (err) {
                      console.error('Failed to pause session', err)
                    }
                    router.push('/dashboard')
                  }}
                  className="
          w-10 h-10 rounded-full p-0 
          bg-gradient-to-br from-red-600 to-red-700 
          hover:from-red-700 hover:to-red-800 
          shadow-xl hover:shadow-2xl 
          hover:scale-105 
          transition-all duration-300 
          ring-8 ring-red-600/20
        "
                >
                  <Phone className="w-9 h-9 rotate-135" />
                </Button>

                {/* Break Phase – Next Round Button */}
                {phase === "BREAK" && (
                  <Button
                    size="lg"
                    className="
            font-bold text-sm 
            bg-gradient-to-r from-indigo-500 to-indigo-600 
            hover:from-indigo-600 hover:to-indigo-700 
            shadow-xl hover:shadow-2xl 
            rounded-full px-5 py-3
            transition-all duration-300
          "
                    onClick={() => {
                      if (currentRole === 'hr') {
                        startRound('expert');
                      } else if (currentRole === 'expert') {
                        startRound('manager');
                      } else {
                        setPhase("COMPLETE");
                        // Send completion email
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
                        setTimeout(() => router.push(`/results/${sessionId}`), 2000);
                      }
                    }}
                  >
                    {currentRole === 'manager' ? 'Complete ✓' : 'Next →'}
                  </Button>
                )}

              </div>
            </div>

          </div>
        </aside>

        {/* Mobile Transcript Sidebar */}
        <aside
          style={{ width: "100%" }}
          className="flex flex-col pb-20 gap-4 lg:hidden"
        >
          <Card className="flex flex-col pb-20 shadow-lg border-white/50 bg-card w-full">
            <div className="flex px-6 py-3 border-b border-border/80">
              <h3 className="font-bold text-lg text-foreground">Live Transcript</h3>
            </div>

            {/* Scrollable Transcript */}
            <div ref={mobileTranscriptRef} className="flex-1 overflow-y-auto p-3 space-y-6 max-h-[65vh] custom-scrollbar-professional">
              {transcript.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground italic">
                  Questions & Answers will appear here...
                </p>
              ) : (
                // show latest messages at top
                [...transcript].reverse().map((item, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${item.type === "answer" ? "flex-row-reverse" : ""
                      } animate-in fade-in-50 duration-300`}
                  >
                    {item.type === "question" ? (
                      <img
                        src={`/videos/${currentRole}/profile.png`}
                        alt="Interviewer"
                        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full border-2 border-white/50 bg-gradient-to-br from-black-200 to-indigo-600 text-white/80 text-xs flex items-center justify-center shadow-md flex-shrink-0">
                        You
                      </div>
                    )}

                    <div
                      className={`max-w-[75%] px-4 py-3 mt-5 shadow-sm ${item.type === "question"
                        ? "bg-primary/10 border text-foreground rounded-tr-4xl rounded-bl-4xl rounded-br-4xl"
                        : "bg-muted border text-muted-foreground rounded-tl-4xl rounded-bl-4xl rounded-br-4xl"
                        }`}
                    >
                      <p className="text-xs leading-relaxed leading-relaxed whitespace-pre-wrap">
                        {item.text || "..."}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Mobile Floating Controls */}
          <div className="fixed inset-0 pointer-events-none z-50">

            {/* Silence detected – countdown will start; user can interrupt by speaking */}
            {isRecording && silenceDetected && silenceCountdown === null && (
              <div className="absolute -top-0.6 right-0 -translate-x-1/2 pointer-events-none">
                <div className="bg-black text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-white/40 animate-pulse">
                  <p className="text-sm font-bold opacity-95">
                    Silence detected — speak now to continue
                  </p>
                </div>
              </div>
            )}

            {/* Auto-Submit Countdown Banner – user can still speak to cancel */}
            {isRecording && silenceCountdown !== null && (
              <div className="absolute -top-0.6 right-0 -translate-x-1/2 pointer-events-none">
                <div className="bg-black text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-white/40 animate-pulse">
                  <p className="text-sm font-bold opacity-95">
                    Auto-submitting in {silenceCountdown}s — speak now to continue
                  </p>
                </div>
              </div>
            )}

            {/* Muted state just before submit */}
            {isRecording && isMuted && (
              <div className="absolute -top-0.6 right-0 -translate-x-1/2 pointer-events-none">
                <div className="bg-black text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-white/40 animate-pulse">
                  <p className="text-sm font-bold opacity-95">
                    Mic muted — submitting your answer
                  </p>
                </div>
              </div>
            )}

            {/* Main Floating Buttons */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div className="flex items-center gap-4 liquid-bg border border-white/50 rounded-full p-4 shadow-xl">

                {/* Show waiting message during question */}
                {phase === 'QUESTION' && (
                  <div className="px-6 py-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-white/90">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <span>Question being asked... Please wait</span>
                    </div>
                  </div>
                )}

                {/* Mic Button - Only show when in LISTENING phase */}
                {phase === 'LISTENING' && questionReady && (
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={!isRecording ? startRecording : undefined}
                    disabled={isRecording}
                    className={`
              relative w-14 h-14 rounded-full p-0 transition-all duration-300
              ${
                        isRecording
                          ? "bg-black-600 text-blue hover:bg-black-700 shadow-lg ring-8 ring-gray-500/30"
                          : "bg-white text-gray-900 hover:scale-105 shadow-xl"
                      }
            `}
                  >
                    {/* Voice Visualization Bars - Mobile */}
                    {isRecording && (
                      <div className="absolute -inset-3 flex items-center justify-center gap-1">
                        {[...Array(5)].map((_, i) => {
                          const phase = (Date.now() / 200 + i * 0.8) % (Math.PI * 2);
                          const wave = (Math.sin(phase) * 0.4 + 0.6);
                          const baseHeight = 5;
                          const maxHeight = 18;
                          const height = baseHeight + (wave * (audioLevel / 100) * maxHeight);
                          return (
                            <div
                              key={i}
                              className="w-1 bg-white rounded-full"
                              style={{
                                height: `${Math.max(baseHeight, height)}px`,
                                opacity: 0.75 + (audioLevel / 400),
                                transition: 'height 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out',
                              }}
                            />
                          );
                        })}
                      </div>
                    )}

                    {!isRecording && (
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 pointer-events-none">
                        <div className="bg-black text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-white/40 animate-pulse">
                          Turn On Your Mic
                        </div>
                      </div>
                    )}

                    {isRecording ? (
                      <div className="relative z-10">
                        <Mic className="w-7 h-7" />
                      </div>
                    ) : (
                      <Mic className="w-7 h-7" />
                    )}
                  </Button>
                )}

                {/* End Call */}
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={async () => {
                    try {
                      if (isRecording) {
                        await submitAnswer()
                      }

                      const token = localStorage.getItem('authToken')
                      await fetch('/api/interview/pause', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token && { Authorization: `Bearer ${token}` }),
                        },
                        body: JSON.stringify({ sessionId, action: 'pause', currentRound: round, questionIndex: questionCount }),
                      })
                    } catch (err) {
                      console.error('Failed to pause session', err)
                    }
                    router.push('/dashboard')
                  }}
                  className="
            w-12 h-12 rounded-full p-0 
            bg-gradient-to-br from-red-600 to-red-700 
            hover:from-red-700 hover:to-red-800 
            shadow-xl hover:shadow-2xl hover:scale-105 
            transition-all duration-300 
            ring-8 ring-red-600/20
          "
                >
                  <Phone className="w-9 h-9 rotate-135" />
                </Button>

                {/* Next Button in Break */}
                {phase === "BREAK" && (
                  <Button
                    size="lg"
                    className="
              font-bold text-xs 
              bg-gradient-to-r from-indigo-500 to-indigo-600 
              hover:from-indigo-600 hover:to-indigo-700 
              shadow-xl hover:shadow-2xl rounded-full px-4 py-2
              transition-all duration-300
            "
                    onClick={() => {
                      if (currentRole === "hr") startRound("expert");
                      else if (currentRole === "expert") startRound("manager");
                      else {
                        setPhase("COMPLETE");
                        setTimeout(() => {
                          router.push(`/interview/results?sessionId=${sessionId}`);
                        }, 2000);
                      }
                    }}
                  >
                    {currentRole === "manager" ? "Complete ✓" : "Next →"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}