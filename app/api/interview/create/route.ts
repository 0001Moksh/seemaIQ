import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import type { ResumeData } from "@/lib/resume-parser"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { role, experience, domain, resumeData } = body
    const db = await getDatabase()

    const sessionData = {
      _id: new ObjectId(),
      userId: new ObjectId(user.userId),
      role, // 'hr', 'technical', 'manager'
      experience, // 'junior', 'mid', 'senior'
      domain, // 'software', 'data', 'product', 'design', 'devops', 'other'
      resumeData: resumeData || null,
      status: "active", // active, paused, completed
      startedAt: new Date(),
      questions: [],
      answers: [],
      currentRound: 1,
      scores: {},
      createdAt: new Date(),
    }

    const result = await db.collection("interviews").insertOne(sessionData)

    return NextResponse.json({
      success: true,
      sessionId: result.insertedId.toString(),
      role,
      experience,
    })
  } catch (error) {
    console.error("Create interview error:", error)
    return NextResponse.json({ error: "Failed to create interview session" }, { status: 500 })
  }
}
