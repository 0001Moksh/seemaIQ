// app/api/interview/question/route.ts  (ya GET handler)
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { generateInterviewQuestion } from "@/lib/gemini"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    const roundParam = request.nextUrl.searchParams.get("round") || "1"

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    const db = await getDatabase()
    const session = await db
      .collection("interviews")
      .findOne({
        _id: new ObjectId(sessionId),
        userId: new ObjectId(user.userId),
      })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const round = Number.parseInt(roundParam)
    const previousQuestions = (session.questions || []).map((q: any) => q.text || "")

    // Determine role for this round: Round 1 = hr, Round 2 = technical, Round 3 = manager
    const roundRole = round === 1 ? "hr" : round === 2 ? "technical" : "manager"

    // Yeh sab pass kar rahe hain → domain bhi included
    let question: string
    try {
      question = await generateInterviewQuestion(
        roundRole as "hr" | "technical" | "manager",
        session.experience as "junior" | "mid" | "senior",
        round,
        previousQuestions,
        session.resumeData || undefined,
        session.domain || "zoho"
      )
    } catch (err) {
      console.error("Gemini failed completely, using fallback")
      // Final safety fallback
      const name = session.resumeData?.name?.split(" ")[0] || "there"
      const domainName = session.domain === "software" ? "software engineering" :
                        session.domain === "data" ? "data science and AI/ML" :
                        session.domain === "product" ? "product management" :
                        session.domain === "design" ? "UI/UX design" :
                        session.domain === "devops" ? "DevOps and cloud" : "your field"

      question = roundRole === "hr" && round === 1
        ? `Hi ${name}, could you please walk me through your background and what excites you about ${domainName}? gemini this time`
        : `Tell me about a challenging situation you faced in ${domainName} and how you handled it.`
    }

    // Save question to DB
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $push: {
          questions: {
            round,
            role: roundRole,
            text: question,
            timestamp: new Date(),
          },
        } as any,
      }
    )

    return NextResponse.json({
      success: true,
      question: {
        id: crypto.randomUUID(),
        text: question,
        round,
        role: roundRole,
        experience: session.experience,
        domain: session.domain,
      },
    })
  } catch (error) {
    console.error("Get question error:", error)
    return NextResponse.json(
      { error: "Failed to generate question. Please try again." },
      { status: 500 }
    )
  }
}