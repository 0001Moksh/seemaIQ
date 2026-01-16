import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { InterviewService } from "@/lib/services/interview.service"

/**
 * GET /api/dashboard/stats
 * Fetch user interview statistics
 * Returns: totalInterviews, averageScore, currentStreak, recentInterviews
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use centralized service layer for better maintainability
    const stats = await InterviewService.getUserStats(user.userId)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error("Get stats error:", error)
    return NextResponse.json(
      { 
        error: "Failed to get stats",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
