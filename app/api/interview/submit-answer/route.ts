import { NextResponse } from "next/server"
import { transcribeAudio, evaluateInterviewAnswer } from "@/lib/gemini"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function POST(request: Request) {
  let improvement_is = '';
  let meta: any = {};
  let evalRes: any = {};

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
          {
            $push: {
              answers: { question, answer, evaluation: evalRes, round, createdAt: new Date() } as any
            },
            $set: { updatedAt: new Date(), lastMeta: meta, questionIndex: completed }
          } as any
        )
      } catch (e) {
        console.error('Database update failed:', e)
      }
    }

    return NextResponse.json({ text: improvement_is, meta, evaluation: evalRes })
  } catch (err: any) {
    console.error('submit-answer error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to submit answer' }, { status: 500 })
  }
}