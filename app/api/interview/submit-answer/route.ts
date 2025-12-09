import { NextResponse } from "next/server"
import { transcribeAudio, evaluateInterviewAnswer } from "@/lib/gemini"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, question, answerText, audioBase64, role = 'hr', round = 1, completedCount = 0, questionsPerRound = 5 } = body

    let answer = answerText || ""

    if (!answer && audioBase64) {
      // decode base64 to buffer
      const raw = Buffer.from(audioBase64, 'base64')
      try {
        answer = await transcribeAudio(raw)
      } catch (e) {
        console.warn('Transcription failed, proceeding with empty answer', e)
        answer = ''
      }
    }

    // Evaluate the answer with LLM
    const evalRes = await evaluateInterviewAnswer(question || '', answer || '', role)

    const improvement_is = evalRes.feedback || ''
    const candidate_score = Math.round((evalRes.clarity + evalRes.relevance + evalRes.completeness + evalRes.confidence) / 4)
    const completed = Number(completedCount || 0) + 1
    const finished = completed >= Number(questionsPerRound || 5)

    const meta = { improvement_is, candidate_score, interview_complete: finished, question_complete: `${completed}/${questionsPerRound}`, role, status: 'conversation' }

    if (sessionId) {
      try {
        const db = await getDatabase()
        await db.collection('sessions').updateOne(
          { _id: new ObjectId(sessionId) },
          { $push: { answers: { question, answer, evaluation: evalRes, round, createdAt: new Date() } }, $set: { updatedAt: new Date(), lastMeta: meta, questionIndex: completed } }
        )
      } catch (e) {
        console.warn('Failed to persist answer to session', e)
      }
    }

    return NextResponse.json({ text: improvement_is, meta, evaluation: evalRes })
  } catch (err: any) {
    console.error('submit-answer error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to submit answer' }, { status: 500 })
  }
}
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { evaluateInterviewAnswer, transcribeAudio, generateInterviewQuestion } from "@/lib/gemini"
import fs from "fs"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const sessionId = formData.get("sessionId") as string
    const questionId = formData.get("questionId") as string
    const audio = formData.get("audio") as Blob
    const video = formData.get("video") as Blob | null

    if (!sessionId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = await getDatabase()
    const session = await db.collection("interviews").findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user.userId),
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Handle audio - if no audio provided, use empty transcription
    let audioBuffer: Buffer | null = null
    let transcription = ""
    const userAnswerFromForm = formData.get("userAnswer") as string
    
    return NextResponse.json({ error: "This endpoint has been removed" }, { status: 410 })
      try {
