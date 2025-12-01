import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    const db = await getDatabase()
    const session = await db.collection("interviews").findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user.userId),
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session._id,
        role: session.role,
        experience: session.experience,
        currentRound: session.currentRound,
        questions: session.questions,
        status: session.status,
      },
    })
  } catch (error) {
    console.error("Get session error:", error)
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 })
  }
}
