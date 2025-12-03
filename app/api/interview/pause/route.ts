import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { sessionId, action, currentRound, questionIndex } = body || {}

    if (!sessionId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = await getDatabase()
    const sessionObjId = new ObjectId(sessionId)

    const session = await db.collection("interviews").findOne({ _id: sessionObjId, userId: new ObjectId(user.userId) })
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    const update: any = {}
    if (action === "pause") {
      update.$set = { status: "paused", pausedAt: new Date() }
    } else if (action === "resume") {
      update.$set = { status: "active", resumedAt: new Date() }
    } else if (action === "complete") {
      update.$set = { status: "completed", completedAt: new Date() }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Optional: persist progress markers
    if (typeof currentRound === "number") {
      update.$set = { ...(update.$set || {}), currentRound }
    }
    if (typeof questionIndex === "number") {
      update.$set = { ...(update.$set || {}), questionIndex }
    }

    await db.collection("interviews").updateOne({ _id: sessionObjId }, update)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Pause endpoint error:", err)
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 })
  }
}
