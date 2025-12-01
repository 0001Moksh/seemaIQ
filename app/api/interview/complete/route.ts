import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    const { db } = await connectToDatabase()

    // Get session and calculate final scores
    const session = await db.collection("interview_sessions").findOne({ _id: sessionId })
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const round1Score = session.roundAverage?.[1] || 0
    const round2Score = session.roundAverage?.[2] || 0
    const round3Score = session.roundAverage?.[3] || 0
    const overallScore = Math.round((round1Score + round2Score + round3Score) / 3)

    // Update session as complete
    await db.collection("interview_sessions").updateOne(
      { _id: sessionId },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          overallScore,
        },
      }
    )

    // Update user stats
    const user = await db.collection("users").findOne({ _id: session.userId })
    if (user) {
      const totalInterviews = (user.total_interviews || 0) + 1
      const bestScore = Math.max(user.best_score || 0, overallScore)
      const averageScore = (
        (user.average_score || 0) * (totalInterviews - 1) +
        overallScore
      ) / totalInterviews

      await db.collection("users").updateOne(
        { _id: session.userId },
        {
          $set: {
            total_interviews: totalInterviews,
            best_score: bestScore,
            average_score: Math.round(averageScore),
          },
        }
      )
    }

    return NextResponse.json({
      status: "completed",
      overallScore,
      round1Score,
      round2Score,
      round3Score,
    })
  } catch (error: any) {
    console.error("Complete interview error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
