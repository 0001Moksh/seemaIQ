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
    const { sessionId, question, answer, round } = body

    if (!sessionId || !question || !answer) {
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
    const candidateName = session.resumeData?.name?.split(" ")[0] || "there"

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const feedbackPrompt = `You are a ${roleTitle} interviewer providing conversational feedback on a candidate's answer.

Question: "${question}"
Candidate's Answer: "${answer}"

Provide constructive, conversational feedback that:
1. Acknowledges what they did well (e.g., "Good point!", "That's a great example!", "I like how you approached that")
2. Points out what could be improved (if needed)
3. Keeps it brief and conversational (1-2 sentences max)
4. Does NOT ask a new question
5. Lastly say "let's move to the next question"

Format: Just the conversational feedback, nothing else. Make it sound natural, like a real interviewer.`

    const result = await model.generateContent(feedbackPrompt)
    const feedback = result.response.text().trim()

    return NextResponse.json({
      success: true,
      feedback,
      round,
    })
  } catch (error) {
    console.error("Feedback generation error:", error)
    return NextResponse.json({ error: "Failed to generate feedback" }, { status: 500 })
  }
}
