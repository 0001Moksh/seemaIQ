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

    const interviews = await db
      .collection("interviews")
      .find({ userId: new ObjectId(user.userId), status: "completed" })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const totalInterviews = interviews.length

    const scores = interviews.map((i: any) => i.finalScore || 0).filter((s: number) => s > 0)

    const averageScore =
      scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0

    const recentInterviews = interviews.slice(0, 5).map((i: any) => ({
      id: i._id,
      role: i.role,
      date: i.createdAt,
      score: i.finalScore || 0,
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
