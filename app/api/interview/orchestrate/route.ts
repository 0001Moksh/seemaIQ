import { NextResponse } from "next/server"
import { generateGroqFollowUpQuestion, generateInterviewQuestion, evaluateInterviewAnswer, QuotaExceededError } from "@/lib/groq"
import { InterviewAgentOrchestrator } from "@/lib/services/interview-agent-orchestrator.service"
import { InterviewService } from "@/lib/services/interview.service"

type Role = "hr" | "technical" | "manager"

const normalizeRole = (role: string): Role => {
  if (role === "expert") return "technical"
  if (role === "technical") return "technical"
  if (role === "manager") return "manager"
  return "hr"
}

async function greetText(role: Role, resumeName?: string, language: string = 'english') {
  const namestr = resumeName ? resumeName.split(" ")[0] : "there"
  
  if (language === 'hindi') {
    if (role === "hr") return `Namaste ${namestr}, मैं Mira Sharma हूं HR से। इस round में हम communication और workplace behaviour पर focus करेंगे। चलिए शुरू करते हैं।`
    if (role === "technical") return `Hi ${namestr}, मैं Ashish Yadev हूं, Domain Expert। मैं आपकी technical approach evaluate करूंगा। Ready हैं?`
    return `Hello ${namestr}, मैं Ryan Bhardwaj हूं, Hiring Manager। यह round leadership और ownership पर focused है।`
  }
  
  if (role === "hr") return `Hello ${namestr}, I’m Mira Sharma from HR. In this round, we’ll focus on communication and workplace behaviour. Let’s begin.`
  if (role === "technical") return `Hi ${namestr}, I’m Ashish Yadev, Domain Expert. I’ll evaluate your technical approach. Ready?`
  return `Good to meet you ${namestr}, I’m Ryan Bhardwaj, Hiring Manager. This round focuses on leadership and ownership.`
}

export async function handleOrchestrate(body: any) {
  const action: string = body.action || "greet"
  const role: Role = normalizeRole(body.role || "hr")
  const round: number = Number(body.round || 1)
  const previousQuestions: string[] = body.previousQuestions || []
  const session = body.sessionId ? await InterviewService.getSession(body.sessionId).catch(() => null) : null
  const resumeData = body.resumeData && Object.keys(body.resumeData).length > 0 ? body.resumeData : session?.resumeData || {}
  const domain = body.domain || session?.domain || resumeData?.domain
  const language = body.language || session?.language || resumeData?.language || "english"
  const conversationMemory = body.conversationMemory || session?.conversationMemory || InterviewAgentOrchestrator.createInitialMemory(body.experience || session?.experience)
  const questionNum = Number(body.questionNum || 1)
  const questionsPerRound = Number(body.questionsPerRound || 5)
  const experience = body.experience || session?.experience || "mid"

  if (action === "greet") {
    const text = await greetText(role, resumeData?.name, language)
    const meta = { improvement_is: "", candidate_score: 0, interview_complete: false, question_complete: `${0}/${questionsPerRound}`, role, status: "greet" }
    
    // Persist session state using service layer
    if (body.sessionId) {
      try {
        await InterviewService.resumeSession(body.sessionId)
      } catch (e) {
        console.warn('Persist greet state failed', e)
      }
    }

    return { text, meta }
  }

  if (action === "question") {
    const q = await generateInterviewQuestion(role === "technical" ? "technical" : role === "hr" ? "hr" : "manager", experience, round, previousQuestions, resumeData, domain)
    const completedSoFar = Math.max(0, questionNum - 1)
    const meta = {
      improvement_is: "",
      candidate_score: 0,
      interview_complete: false,
      question_complete: `${completedSoFar}/${questionsPerRound}`,
      role,
      status: "question",
      memory: conversationMemory,
      adaptiveDifficulty: conversationMemory.adaptiveDifficulty,
    }
    
    if (body.sessionId) {
      try {
        await InterviewService.addQuestion(body.sessionId, {
          text: q,
          round,
          questionNum,
        })
      } catch (e) {
        console.warn('Persist question state failed', e)
      }
    }
    return { text: q, meta }
  }

  if (action === "evaluate") {
    const question = body.question || ""
    const answer = body.answer || ""
    if (!question || !answer) {
      const coachingText = InterviewAgentOrchestrator.buildRoundTransitionText(role, conversationMemory)
      return {
        text: coachingText,
        meta: {
          improvement_is: coachingText,
          candidate_score: conversationMemory.lastAnswerQuality || 0,
          interview_complete: false,
          question_complete: `${Math.min(Number(body.completedCount || 0), questionsPerRound)}/${questionsPerRound}`,
          role,
          status: "coaching",
          nextAction: "round_transition",
          memory: conversationMemory,
          adaptiveDifficulty: conversationMemory.adaptiveDifficulty,
        },
        evaluation: {
          feedback: coachingText,
          improvementTips: coachingText,
        },
      }
    }
    const evalRes = await evaluateInterviewAnswer(question, answer, role === "technical" ? "technical" : role === "hr" ? "hr" : "manager")
    const improvement_is = evalRes.feedback || ""
    const candidate_score = Math.round((evalRes.clarity + evalRes.relevance + evalRes.completeness + evalRes.confidence) / 4)
    const completedCount = Number(body.completedCount || 0) + 1
    const finished = completedCount >= questionsPerRound
    const updatedMemory = InterviewAgentOrchestrator.updateMemoryFromAnswer(conversationMemory, {
      answer,
      evaluation: evalRes,
      question,
      role,
      domain,
    })
    const shouldProbe = InterviewAgentOrchestrator.shouldAskFollowUp(updatedMemory, evalRes, answer, finished)

    let followUpQuestion = ""
    if (shouldProbe && question && answer) {
      followUpQuestion = await generateGroqFollowUpQuestion(
        question,
        answer,
        role === "technical" ? "technical" : role === "hr" ? "hr" : "manager",
        resumeData?.name || "Candidate",
        domain || "this role"
      )
      updatedMemory.followUpDepth += 1
    } else {
      updatedMemory.followUpDepth = 0
    }

    const meta = {
      improvement_is,
      candidate_score,
      interview_complete: finished,
      question_complete: `${completedCount}/${questionsPerRound}`,
      role,
      status: shouldProbe ? "followup" : "conversation",
      nextAction: shouldProbe ? "followup" : finished ? "round_transition" : "continue",
      memory: updatedMemory,
      adaptiveDifficulty: updatedMemory.adaptiveDifficulty,
    }
    
    if (body.sessionId) {
      try {
        await InterviewService.addAnswer(body.sessionId, {
          question,
          answer,
          evaluation: evalRes,
          round,
        })
        
        // Auto-complete session when all questions are answered
        if (finished) {
          await InterviewService.updateConversationMemory(body.sessionId, updatedMemory)
          await InterviewService.completeSession(body.sessionId)
        } else {
          await InterviewService.updateConversationMemory(body.sessionId, updatedMemory)
        }
      } catch (e) {
        console.warn('Persist evaluate state failed', e)
      }
    }
    return { text: improvement_is, meta, evaluation: evalRes, followUpQuestion }
  }

  throw new Error("Unknown action")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const res = await handleOrchestrate(body)
    return NextResponse.json(res)
  } catch (err: any) {
    console.error("Orchestrator error:", err)
    
    // Handle Groq quota exceeded (429)
    if (err instanceof QuotaExceededError) {
      const retryAfter = err.retryAfterSeconds || 60
      console.warn(`Groq quota exceeded. Retry after ${retryAfter}s`)
      return NextResponse.json(
        { 
          error: "API quota exceeded",
          message: `Groq API quota exceeded. Please try again in ${retryAfter} seconds.`,
          code: "QUOTA_EXCEEDED",
          retryAfter
        },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
      )
    }

    return NextResponse.json(
      { 
        error: err?.message || "Failed to orchestrate",
        details: process.env.NODE_ENV === "development" ? err?.stack : undefined
      }, 
      { status: 500 }
    )
  }
}
