import { NextResponse } from "next/server"
import { generateInterviewQuestion, evaluateInterviewAnswer, QuotaExceededError, switchGeminiApiKey } from "@/lib/gemini"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

type Role = "hr" | "technical" | "manager"

const normalizeRole = (role: string): Role => {
  if (role === "expert") return "technical"
  if (role === "technical") return "technical"
  if (role === "manager") return "manager"
  return "hr"
}

async function greetText(role: Role, resumeName?: string) {
  const namestr = resumeName ? resumeName.split(" ")[0] : "there"
  if (role === "hr") return `Hello ${namestr}, I’m Mira Sharma from HR. In this round, we’ll focus on communication and workplace behaviour. Let’s begin.`
  if (role === "technical") return `Hi ${namestr}, I’m Ashish Yadev, Domain Expert. I’ll evaluate your technical approach. Ready?`
  return `Good to meet you ${namestr}, I’m Ryan Bhardwaj, Hiring Manager. This round focuses on leadership and ownership.`
}

export async function handleOrchestrate(body: any) {
  const action: string = body.action || "greet"
  const role: Role = normalizeRole(body.role || "hr")
  const round: number = Number(body.round || 1)
  const previousQuestions: string[] = body.previousQuestions || []
  const resumeData = body.resumeData || {}
  const domain = body.domain || resumeData?.domain
  const questionNum = Number(body.questionNum || 1)
  const questionsPerRound = Number(body.questionsPerRound || 5)

  if (action === "greet") {
    const text = await greetText(role, resumeData?.name)
    const meta = { improvement_is: "", candidate_score: 0, interview_complete: false, question_complete: `${0}/${questionsPerRound}`, role, status: "greet" }
    // persist session state if sessionId present
    if (body.sessionId) {
      try {
        const db = await getDatabase()
        await db.collection('sessions').updateOne(
          { _id: new ObjectId(body.sessionId) },
          { $set: { status: 'active', role, currentRound: body.round || 1, updatedAt: new Date(), lastMeta: meta } }
        )
      } catch (e) {
        console.warn('Persist greet state failed', e)
      }
    }

    return { text, meta }
  }

  if (action === "question") {
    const q = await generateInterviewQuestion(role === "technical" ? "technical" : role === "hr" ? "hr" : "manager", resumeData?.experience || "mid", round, previousQuestions, resumeData, domain)
    const completedSoFar = Math.max(0, questionNum - 1)
    const meta = { improvement_is: "", candidate_score: 0, interview_complete: false, question_complete: `${completedSoFar}/${questionsPerRound}`, role, status: "question" }
    if (body.sessionId) {
      try {
        const db = await getDatabase()
        await db.collection('sessions').updateOne(
          { _id: new ObjectId(body.sessionId) },
          { $set: { questionIndex: questionNum, updatedAt: new Date(), lastMeta: meta }, $push: { questions: { text: q, round, questionNum, createdAt: new Date() } } }
        )
      } catch (e) {
        console.warn('Persist question state failed', e)
      }
    }
    return { text: q, meta }
  }

  if (action === "evaluate") {
    const question = body.question || ""
    const answer = body.answer || ""
    const evalRes = await evaluateInterviewAnswer(question, answer, role === "technical" ? "technical" : role === "hr" ? "hr" : "manager")
    const improvement_is = evalRes.feedback || ""
    const candidate_score = Math.round((evalRes.clarity + evalRes.relevance + evalRes.completeness + evalRes.confidence) / 4)
    const completedCount = Number(body.completedCount || 0) + 1
    const finished = completedCount >= questionsPerRound
    const meta = { improvement_is, candidate_score, interview_complete: finished, question_complete: `${completedCount}/${questionsPerRound}`, role, status: "conversation" }
    if (body.sessionId) {
      try {
        const db = await getDatabase()
        await db.collection('sessions').updateOne(
          { _id: new ObjectId(body.sessionId) },
          { $push: { answers: { question, answer, evaluation: evalRes, round, createdAt: new Date() } }, $set: { updatedAt: new Date(), lastMeta: meta, questionIndex: completedCount } }
        )
      } catch (e) {
        console.warn('Persist evaluate state failed', e)
      }
    }
    return { text: improvement_is, meta, evaluation: evalRes }
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
    
    // Handle Gemini quota exceeded (429)
    if (err instanceof QuotaExceededError) {
      const retryAfter = err.retryAfterSeconds || 60
      console.warn(`Gemini quota exceeded. Retry after ${retryAfter}s`)
      return NextResponse.json(
        { 
          error: "API quota exceeded",
          message: `Gemini API quota exceeded. Please try again in ${retryAfter} seconds.`,
          code: "QUOTA_EXCEEDED",
          retryAfter
        },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
      )
    }

    return NextResponse.json(
      { error: err?.message || "Failed to orchestrate" }, 
      { status: 500 }
    )
  }
}
