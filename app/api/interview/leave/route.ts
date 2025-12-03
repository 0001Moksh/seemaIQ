import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { sessionId } = body
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

    const db = await getDatabase()
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(sessionId) },
      { $pull: { activeJoiners: new ObjectId(user.userId) }, $set: { lastActiveAt: new Date() } }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Leave error:", err)
    return NextResponse.json({ error: "Failed to leave session" }, { status: 500 })
  }
}
