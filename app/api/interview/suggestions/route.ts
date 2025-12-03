import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, round } = body

    if (!sessionId || !round) {
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

    const roleMap: Record<number, string> = { 1: "HR", 2: "Technical", 3: "Manager" }
    const roleTitle = roleMap[round] || "HR"
    const candidateName = session.resumeData?.name?.split(" ")[0] || "candidate"

    // Get all answers from this round (5 answers)
    const totalAnswers = (session.answers || []).length
    const startIdx = (round - 1) * 5
    const roundAnswers = session.answers?.slice(startIdx, startIdx + 5) || []

    // Build conversation summary
    const questionsAndAnswers = (session.questions || [])
      .filter((q: any) => q.round === round)
      .map((q: any, idx: number) => ({
        question: q.text,
        answer: roundAnswers[idx]?.text || "",
      }))
      .join("\n\n")

    let suggestions = ""
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "")
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const suggestionPrompt = `You are a ${roleTitle} interviewer providing overall feedback after the ${roleTitle} round of interviews.

CONVERSATION:
${questionsAndAnswers}

Provide 2-3 key suggestions for ${candidateName} based on their performance in this round:
1. What they did well (specific examples)
2. What they can improve
3. A motivational note

Format: Natural, conversational feedback (3-4 sentences total). NOT a list. Make it sound like a real interviewer speaking.`

      const result = await model.generateContent(suggestionPrompt)
      suggestions = result.response.text().trim()
    } catch (aiErr) {
      console.error("Suggestions generation failed, using fallback:", aiErr)
      suggestions = `${roleTitle} feedback: Good job overall. Focus on structuring answers with a clear example and sharpening technical depth where needed. Keep confidence high and engage the interviewer with concise, targeted responses.`
    }

    // Persist suggestions to interviews collection
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { [`roundSuggestions.${round}`]: suggestions } }
    )

    return NextResponse.json({
      success: true,
      suggestions,
      round,
      roundTitle: roleTitle,
    })
  } catch (error) {
    console.error("Suggestions generation error:", error)
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 })
  }
}
