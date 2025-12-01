import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { sendEmail, getInterviewCompletionEmailTemplate } from "@/lib/email"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    const db = await getDatabase()
    const userDoc = await db.collection("users").findOne({
      _id: new ObjectId(user.userId),
    })

    const interview = await db.collection("interviews").findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user.userId),
    })

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 })
    }

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (interview.status !== "completed") {
      return NextResponse.json({ error: "Interview not completed" }, { status: 400 })
    }

    const resultsUrl = `${process.env.APP_URL}/interview/results?sessionId=${sessionId}`

    await sendEmail({
      to: userDoc.email,
      subject: `Your SeemaIQ ${interview.role} Interview Results - Score: ${interview.finalScore}`,
      html: getInterviewCompletionEmailTemplate(userDoc.name, interview.finalScore, interview.role, resultsUrl),
    })

    // Mark email as sent
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          resultEmailSent: true,
          resultEmailSentAt: new Date(),
        },
      },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Send interview complete email error:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
