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

    const db = await getDatabase()

    // Include all interviews for this user (active, paused, completed)
    const interviews = await db
      .collection("interviews")
      .find({ userId: new ObjectId(user.userId) })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const totalInterviews = interviews.length

    // Average score only for completed interviews with a finalScore
    const completedScores = interviews
      .filter((i: any) => i.status === "completed")
      .map((i: any) => i.finalScore || 0)
      .filter((s: number) => s > 0)

    const averageScore =
      completedScores.length > 0
        ? Math.round(completedScores.reduce((a: number, b: number) => a + b, 0) / completedScores.length)
        : 0

    const recentInterviews = interviews.slice(0, 5).map((i: any) => ({
      id: i._id.toString(),
      role: i.role,
      date: i.createdAt,
      score: i.finalScore || 0,
      status: i.status || "active",
      sessionId: i._id.toString(),
      roundsCompleted: Math.max(0, (i.currentRound || 1) - 1),
    }))

    return NextResponse.json({
      success: true,
      stats: {
        totalInterviews,
        averageScore,
        currentStreak: 5, // TODO: Calculate actual streak
        recentInterviews,
      },
    })
  } catch (error) {
    console.error("Get stats error:", error)
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 })
  }
}
