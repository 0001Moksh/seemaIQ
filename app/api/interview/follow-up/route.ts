import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { generateFollowUpQuestion } from "@/lib/gemini"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, previousQuestion, candidateAnswer, round } = body

    if (!sessionId || !previousQuestion || !candidateAnswer) {
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

    const roleMap: Record<number, string> = { 1: "hr", 2: "technical", 3: "manager" }
    const role = roleMap[round] || "hr"
    const candidateName = session.resumeData?.name?.split(" ")[0] || "candidate"
    const domain = session.domain || "software"

    // Generate a contextual follow-up question
    const followUpQuestion = await generateFollowUpQuestion(
      previousQuestion,
      candidateAnswer,
      role as "hr" | "technical" | "manager",
      candidateName,
      domain
    )

    return NextResponse.json({
      success: true,
      followUpQuestion,
      round,
      role,
    })
  } catch (error) {
    console.error("Follow-up generation error:", error)
    return NextResponse.json({ error: "Failed to generate follow-up question" }, { status: 500 })
  }
}
