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
    const interview = await db.collection("interviews").findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user.userId),
    })

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 })
    }

    if (interview.status !== "completed") {
      return NextResponse.json({ error: "Interview not completed" }, { status: 400 })
    }

    const metrics = calculateMetrics(interview.answers)
    const improvements = generateImprovements(metrics, interview.role)
    const roundScores = calculateRoundScores(interview.answers)

    const result = {
      id: interview._id.toString(),
      finalScore: interview.finalScore,
      role: interview.role,
      experience: interview.experience,
      completedAt: interview.completedAt,
      metrics,
      improvements,
      roundScores,
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("Get results error:", error)
    return NextResponse.json({ error: "Failed to get results" }, { status: 500 })
  }
}

function calculateMetrics(answers: any[]): Array<{ label: string; score: number }> {
  if (!answers || answers.length === 0) {
    return [
      { label: "Communication", score: 0 },
      { label: "Technical Knowledge", score: 0 },
      { label: "Confidence", score: 0 },
      { label: "Problem Solving", score: 0 },
    ]
  }

  let clarity = 0,
    relevance = 0,
    completeness = 0,
    confidence = 0

  answers.forEach((answer) => {
    if (answer.evaluation) {
      clarity += answer.evaluation.clarity || 0
      relevance += answer.evaluation.relevance || 0
      completeness += answer.evaluation.completeness || 0
      confidence += answer.evaluation.confidence || 0
    }
  })

  const count = answers.length || 1

  return [
    {
      label: "Communication",
      score: Math.round((clarity + relevance) / (2 * count)),
    },
    {
      label: "Technical Knowledge",
      score: Math.round(completeness / count),
    },
    {
      label: "Confidence",
      score: Math.round(confidence / count),
    },
    {
      label: "Problem Solving",
      score: Math.round((completeness + relevance) / (2 * count)),
    },
  ]
}

function generateImprovements(metrics: Array<{ label: string; score: number }>, role: string): string[] {
  const improvements: string[] = []

  const sortedMetrics = [...metrics].sort((a, b) => a.score - b.score)

  sortedMetrics.slice(0, 2).forEach((metric) => {
    switch (metric.label) {
      case "Communication":
        improvements.push(
          'Focus on speaking clearly and maintaining good pace. Avoid using filler words like "um" and "uh".',
        )
        break
      case "Technical Knowledge":
        improvements.push("Deepen your understanding of core technical concepts. Practice coding problems regularly.")
        break
      case "Confidence":
        improvements.push(
          "Build confidence by practicing more mock interviews. Prepare thoroughly for common questions.",
        )
        break
      case "Problem Solving":
        improvements.push(
          "Work on breaking down complex problems. Practice thinking out loud and explaining your approach.",
        )
        break
    }
  })

  if (improvements.length < 4) {
    improvements.push("Continue practicing to maintain and improve your strong areas.")
    improvements.push("Ask for feedback and incorporate it into your preparation.")
  }

  return improvements.slice(0, 4)
}

function calculateRoundScores(answers: any[]): Array<{ round: number; score: number }> {
  const roundGroups: Record<number, any[]> = {}

  answers.forEach((answer, index) => {
    const round = Math.floor(index / 3) + 1
    if (!roundGroups[round]) {
      roundGroups[round] = []
    }
    roundGroups[round].push(answer)
  })

  return Object.keys(roundGroups)
    .map((round) => {
      const roundAnswers = roundGroups[Number.parseInt(round)]
      let totalScore = 0

      roundAnswers.forEach((answer) => {
        if (answer.evaluation) {
          totalScore +=
            (answer.evaluation.clarity +
              answer.evaluation.relevance +
              answer.evaluation.completeness +
              answer.evaluation.confidence) /
            4
        }
      })

      return {
        round: Number.parseInt(round),
        score: Math.round(totalScore / roundAnswers.length),
      }
    })
    .sort((a, b) => a.round - b.round)
}
