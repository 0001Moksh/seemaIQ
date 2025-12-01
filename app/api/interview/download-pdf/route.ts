import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { generateInterviewPDF } from "@/lib/pdf-generator"
import type { PDFReportData, InterviewRoundData } from "@/lib/pdf-generator"

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

    if (!session || session.status !== "completed") {
      return NextResponse.json({ error: "Interview not completed or not found" }, { status: 404 })
    }

    // Build round data from session
    const rounds: InterviewRoundData[] = []

    // Questions are grouped by round
    const questionsByRound: Record<number, any[]> = {}
    ;(session.questions || []).forEach((q: any) => {
      if (!questionsByRound[q.round]) questionsByRound[q.round] = []
      questionsByRound[q.round].push(q)
    })

    // Answers are in order
    const answers = session.answers || []
    let answerIndex = 0

    ;[1, 2, 3].forEach((round) => {
      const questionCount = questionsByRound[round]?.length || 5
      const roundAnswers = answers.slice(answerIndex, answerIndex + questionCount)
      answerIndex += questionCount

      const questionsAndAnswers = questionsByRound[round]?.map((q: any, idx: number) => ({
        question: q.text,
        answer: roundAnswers[idx]?.text || "",
        evaluation: roundAnswers[idx]?.evaluation,
      })) || []

      const roundScore = roundAnswers.length > 0
        ? Math.round(roundAnswers.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / roundAnswers.length)
        : 0

      rounds.push({
        round,
        role: round === 1 ? "hr" : round === 2 ? "technical" : "manager",
        questionsAndAnswers,
        roundScore,
        feedback: roundAnswers[roundAnswers.length - 1]?.roundFeedback, // If stored during answer submission
      })
    })

    // Build PDF data
    const pdfData: PDFReportData = {
      candidateName: session.resumeData?.name || "Candidate",
      candidateEmail: session.resumeData?.email || "Not provided",
      domain: session.domain || "software",
      experienceLevel: session.experience || "mid",
      resumeData: session.resumeData,
      rounds,
      finalScore: session.finalScore || 0,
      generatedAt: new Date(),
    }

    // Generate PDF
    const pdfBuffer = await generateInterviewPDF(pdfData)

    // Return PDF as response (convert to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="interview-report-${sessionId}.pdf"`,
      },
    })
  } catch (error) {
    console.error("PDF generation error:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
