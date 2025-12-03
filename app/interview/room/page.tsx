"use client";
import { Mic, Sparkles, Volume2, Phone, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

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
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [suggestionsText, setSuggestionsText] = useState<string | null>(null);
  const [roundEvaluation, setRoundEvaluation] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<{ type: "question" | "answer"; text: string }[]>([]);
  const [questionReady, setQuestionReady] = useState(false);
  const [asideWidth, setAsideWidth] = useState<number>(384);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isFetchingQuestionRef = useRef(false);

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
          headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : undefined },
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
          headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : undefined },
          body: JSON.stringify({ sessionId }),
        })
      } catch (err) {
        // ignore
      }
    };
  }, []);

  const cleanup = () => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    recognitionRef.current?.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    window.speechSynthesis?.cancel();
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }
  };

  const getMaxQuestionsForRole = (role: Role): number => {
    // Fixed to 5 questions per round for all roles
    return 5;
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
    return new Promise<void>((resolve) => {
      try {
        window.speechSynthesis?.cancel();
        setIsSpeaking(true);
        // show interviewer video only while speaking (except during listening)
        const phaseToUse = p ?? phase;
        const v = getVideoForPhase(role, phaseToUse)
        if (v) setVideoUrl(v)
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 1.2;
        utterance.onend = () => {
          setIsSpeaking(false);
          // hide interviewer video after speaking unless we're in LISTENING phase
          if (phaseToUse !== 'LISTENING') setVideoUrl(null)
          // mark question ready when a question just finished speaking
          if (phaseToUse === 'QUESTION') {
            setQuestionReady(true);
            setPhase('LISTENING');
          }
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          if (phaseToUse !== 'LISTENING') setVideoUrl(null)
          resolve();
        };
        window.speechSynthesis.speak(utterance);
        setTimeout(() => {
          setIsSpeaking(false);
          if (phaseToUse !== 'LISTENING') setVideoUrl(null)
          // ensure questionReady if this was a question
          if (phaseToUse === 'QUESTION') {
            setQuestionReady(true);
            setPhase('LISTENING');
          }
          resolve();
        }, 30000);
      } catch (err) {
        setIsSpeaking(false);
        if ((p ?? phase) !== 'LISTENING') setVideoUrl(null)
        resolve();
      }
    });
  };

  const fetchGreeting = async (roleArg?: Role) => {
    try {
      let candidateName = "there";
      try {
        const sess = (window as any).__SESSION;
        if (sess?.resumeData?.name) candidateName = sess.resumeData.name.split(" ")[0];
      } catch { }

      const templates: Record<string, string> = {
        hr: `Hello ${candidateName}, I’m Mira Sharma from HR. In this round, we’ll focus on communication, attitude and workplace behavior. Let’s begin`,
        expert: `Hi ${candidateName}, I’m Ashish Yadav, Domain Expert. I’ll be evaluating your problem-solving approach and your technical fundamentals. Ready to start?`,
        manager: `Good to meet you ${candidateName}, I’m Ryan Bhardwaj, Hiring Manager. This round focuses on leadership, ownership and past experience. Let’s proceed.`,
      };

      const roleToUse = roleArg ?? currentRole;
      const greeting = templates[roleToUse] || `Hello ${candidateName}, let's begin.`;
      setGreetingText(greeting);
      setPhase("GREET");
      setVideoUrl(`/videos/${roleToUse}/greet.mp4`);

      speak(greeting, roleToUse, 'GREET').catch(() => { });

      setTimeout(() => {
        if (!isFetchingQuestionRef.current) fetchQuestion(1, roleToUse);
      }, 2500);
    } catch (err) {
      setTimeout(() => fetchQuestion(1, roleArg), 1000);
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
      const res = await fetch(`/api/interview/question?sessionId=${sessionId}&round=${round}&questionNum=${num}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const { question } = await res.json();
      setCurrentQuestion(question);
      setTranscript(prev => {
        const last = prev[prev.length - 1];
        if (last && last.type === "question" && last.text === question.text) return prev;
        return [...prev, { type: "question", text: question.text }];
      });
      setCurrentQuestion(question);
      const roleToUse = roleArg ?? currentRole;
      setPhase("QUESTION");
      setGreetingText(null);
      setFeedbackText(null);
      setVideoUrl(`/videos/${roleToUse}/question.mp4`);
      speak(question.text, roleToUse, 'QUESTION')
        .then(() => setQuestionReady(true))
        .catch(() => setQuestionReady(true));
      // Fallback in case speechSynthesis doesn't fire onend
      setTimeout(() => setQuestionReady(true), 12000);
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
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/interview/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          question: currentQuestion?.text,
          answer: currentAnswer.current,
          round
        }),
      });

      if (res.ok) {
        const { feedback } = await res.json();
        setFeedbackText(feedback);
        setPhase("FEEDBACK");
        setVideoUrl(`/videos/${currentRole}/conversation.mp4`);
        await speak(feedback, currentRole, 'FEEDBACK').catch(() => { });
        setFeedbackText(null);
        const maxQuestions = getMaxQuestionsForRole(currentRole);
        if (questionCount < maxQuestions) {
          setQuestionCount(prev => prev + 1);
          fetchQuestion(questionCount + 1);
        } else {
          evaluateRound();
        }
      }
    } catch (err) {
      setQuestionCount(prev => prev + 1);
      setTimeout(() => fetchQuestion(questionCount + 1), 1500);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const token = localStorage.getItem("authToken");

      // First call evaluation to get per-round scores
      try {
        const evalRes = await fetch("/api/interview/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : undefined,
          },
          body: JSON.stringify({ sessionId, round, role: currentRole }),
        });
        if (evalRes.ok) {
          const evalJson = await evalRes.json();
          setRoundEvaluation(evalJson);
          setPhase("EVALUATING");
          setVideoUrl(`/videos/${currentRole}/conversation.mp4`);
        }
      } catch (e) {
        console.error("Evaluation call failed", e);
      }

      // Then fetch suggestions as before
      const res = await fetch("/api/interview/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        body: JSON.stringify({ sessionId, round }),
      });

      if (res.ok) {
        const { suggestions } = await res.json();
        setSuggestionsText(suggestions);
        setPhase("SUGGESTIONS");
        setVideoUrl(`/videos/${currentRole}/conversation.mp4`);
        await speak(suggestions, currentRole, 'SUGGESTIONS').catch(() => { });
        setSuggestionsText(null);
        setPhase("BREAK");
      }
    } catch (err) {
      setPhase("BREAK");
    }
  };

  const startRecording = async () => {
    try {
      cleanup();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      setTranscript(prev => [...prev, { type: "answer", text: "" }]);

      startSpeechRecognition();
    } catch {
      alert("Please allow microphone access");
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

    rec.onresult = (e: any) => {
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
        resetSilenceTimer();
      }
      if (interim && hasSpoken.current) {
        updateLastAnswer(currentAnswer.current + interim);
      }
    };

    rec.onerror = (e: any) => console.error("Speech recognition error", e.error);
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

    if (!hasSpoken.current) return;

    silenceTimerRef.current = setTimeout(() => {
      let sec = 3;
      setSilenceCountdown(sec);
      countdownRef.current = setInterval(() => {
        sec--;
        setSilenceCountdown(sec);
        if (sec <= 0) {
          clearInterval(countdownRef.current!);
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

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("sessionId", sessionId!);
    form.append("questionId", currentQuestion.id);
    form.append("userAnswer", currentAnswer.current);
    if (blob.size > 0) form.append("audio", blob, "answer.webm");

    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/interview/submit-answer", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (res.ok) {
        const data = await res.json();
        const maxQuestions = getMaxQuestionsForRole(currentRole);
        if (questionCount >= maxQuestions) {
          setPhase("EVALUATING");
        }
        if (data.completed) {
          setPhase("COMPLETE");
          setTimeout(() => router.push(`/interview/results?sessionId=${sessionId}`), 2000);
          return;
        }
        if (data.question) {
          fetchFeedback();
          return;
        }
      }
    } catch (err) { }

    const shouldAskFollowUp = Math.random() > 0.7;
    if (questionCount < 5 && !shouldAskFollowUp) {
      setQuestionCount(prev => prev + 1);
      setTimeout(() => fetchQuestion(questionCount + 1), 1500);
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
    }, 800);
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
      <header className="bg-black border-b border-border px-4 lg:px-6 py-3 lg:py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="w-2 h-2 lg:w-3 lg:h-3 bg-green-500 rounded-full animate-pulse shadow-lg" />
          <div className="min-w-0">
            <h1 className="text-sm lg:text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent truncate">
              {currentRole.toUpperCase()} Round • Q{questionCount}/{getMaxQuestionsForRole(currentRole)}
            </h1>
            <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 lg:mt-1 truncate">
              {phase === 'GREET' ? 'Greeting…' : phase === 'QUESTION' ? 'Questioning…' : phase === 'LISTENING' ? 'Listening…' : phase === 'FEEDBACK' ? 'Feedback…' : phase === 'SUGGESTIONS' ? 'Suggestions…' : phase === 'EVALUATING' ? 'Evaluating…' : phase === 'BREAK' ? 'Break…' : phase === 'COMPLETE' ? 'Complete' : ''}
            </p>
          </div>
        </div>
        <div>
          {phase === 'BREAK' && !videoUrl && (
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('authToken')
                  await fetch('/api/interview/pause', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: token ? `Bearer ${token}` : undefined,
                    },
                    body: JSON.stringify({ sessionId, action: 'resume' }),
                  })
                } catch (err) {
                  console.error('Failed to resume session', err)
                }
                setVideoUrl(`/videos/${currentRole}/question.mp4`)
                setPhase('QUESTION')
                fetchQuestion(questionCount)
              }}
            >
              Resume Interview
            </Button>
          )}
        </div>

      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-6 relative">
        <section className="flex-1 relative min-h-96 lg:min-h-full">

          <div className="relative h-96 border border-primary/50 lg:h-full bg-black shadow-2xl rounded-lg lg:rounded-2xl overflow-hidden">
            {videoUrl ? (
              <video
                key={videoUrl}
                src={videoUrl}
                autoPlay
                muted={true}
                loop={phase === "LISTENING"}
                playsInline
                onEnded={handleVideoEnd}
                className="w-full h-full rounded-lg lg:rounded-2xl border-2 lg:border-[3px] border-primary object-cover shadow-2xl ring-1 ring-white/90" />
            ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center text-white text-xl">
                    <div className="flex flex-col items-center gap-4">
                      <img src={`/videos/${currentRole}/profile.png`} alt="Interviewer" className="w-36 h-36 rounded-full object-cover border-2 border-white/40 shadow-2xl" />
                      <p className="text-lg">{phase === 'BREAK' ? 'Now you can move to Next Round' : 'Loading...'}</p>
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
           
            {/* {phase === "FEEDBACK" && feedbackText && (
              <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-0">
                <div className="bg-black/20 backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs backdrop-blur-xs rounded-lg lg:rounded-2xl p-4 lg:p-8 max-w-5xl mx-auto border border-white/10 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <p className="text-sm lg:text-lg text-white leading-relaxed animate-in fade-in flex-1">{feedbackText}</p>
                    <Volume2 className="w-5 lg:w-6 h-5 lg:h-6 text-white/80 ml-4 flex-shrink-0" />
                  </div>
                </div>
              </div>
            )} */}

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

            {/* Auto-Submit Countdown – Top Center */}
            {isRecording && silenceCountdown !== null && (
              <div className="absolute bottom-10 right-25 -translate-x-1/2 animate-in slide-in-from-top fade-in duration-500">
                <div className="bg-black/0 backdrop-blur-xl border border-white/20 text-white px-3 py-2 rounded-2xl shadow-2xl">
                  <p className="text-sm font-medium opacity-90">Auto-submitting in {silenceCountdown}</p>
                </div>
              </div>
            )}

            {/* Floating Controls – Bottom Right */}
            <div className="absolute bottom-20 lg:bottom-8 right-8 pointer-events-auto">
              <div className="flex items-center gap-5 liquid-bg border border-white/20 rounded-full p-4 shadow-2xl">

                {/* Mic Button – Main Action */}
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={(phase === 'LISTENING' && questionReady) ? startRecording : undefined}
                  disabled={!(phase === 'LISTENING' && questionReady) || isRecording}
                  className={`
          relative w-10 h-10 rounded-full p-0 transition-all duration-300 group
          ${!questionReady
                      ? "bg-gray-600/40 text-gray-500 cursor-not-allowed"
                      : isRecording
                        ? "bg-white-600 text-black hover:bg-red-700 shadow-2xl ring-8 ring-red-500/30 animate-pulse"
                        : "bg-white text-gray-900 hover:scale-105 shadow-xl"
                    }
                    `}
                >
                  {/* Tooltip – Only when ready & not recording */}
                  {!isRecording && questionReady && phase === 'LISTENING' && (
                    <div className="absolute -top-16 -translate-x-1/2 pointer-events-none">
                      <div className="relative bg-black text-white text-sm font-medium px-4 py-2.5 
                rounded-xl shadow-xl backdrop-blur-md animate-pulse
                border border-white/40">

                        Turn On Your Mic

                        {/* Arrow */}
                        <div className="w-3 h-3 bg-black rotate-45 absolute -bottom-[6px] right-4 
                  border-b border-r border-white/40" />
                      </div>
                    </div>
                  )}

                  {/* Icon / REC Label */}
                  {isRecording ? (
                    <span className="text-2xl font-extrabold tracking-wider"></span>
                  ) : (
                    <Mic className="w-10 h-10" />
                  )}
                </Button>

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
                          Authorization: token ? `Bearer ${token}` : undefined,
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
                        setTimeout(() => router.push(`/interview/results?sessionId=${sessionId}`), 2000);
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

            {/* Auto Submit Banner */}
            {isRecording && silenceCountdown !== null && (
              <div className="absolute bottom-24 right-1/2 translate-x-1/2 animate-in slide-in-from-top fade-in duration-500">
                <div className="bg-black/80 backdrop-blur-xl border border-white/20 text-white px-4 py-2 rounded-xl shadow-xl">
                  <p className="text-sm font-medium opacity-90">
                    Auto-submitting in {silenceCountdown}
                  </p>
                </div>
              </div>
            )}

            {/* Main Floating Buttons */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div className="flex items-center gap-4 liquid-bg border border-white/50 rounded-full p-4 shadow-xl">

                {/* Mic Button */}
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={(phase === 'LISTENING' && questionReady) ? startRecording : undefined}
                  disabled={!(phase === 'LISTENING' && questionReady) || isRecording}
                  className={`
            relative w-12 h-12 rounded-full p-0 transition-all duration-300
            ${!questionReady
                      ? "bg-gray-600/40 text-gray-500 cursor-not-allowed"
                      : isRecording
                        ? "bg-white-600 text-black hover:bg-red-700 shadow-lg ring-8 ring-red-500/30 animate-pulse"
                        : "bg-white text-gray-900 hover:scale-105 shadow-xl"
                    }
          `}
                >
                  {!isRecording && questionReady && phase === 'LISTENING' && (
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 pointer-events-none">
                      <div className="bg-black text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-white/40 animate-pulse">
                        Turn On Your Mic
                      </div>
                    </div>
                  )}

                  {isRecording ? (
                    <span className="text-xl font-bold"></span>
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </Button>

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
                          Authorization: token ? `Bearer ${token}` : undefined,
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