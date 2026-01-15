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

    // Check both sessions and interviews collections
    let session = await db.collection("sessions").findOne({
      _id: new ObjectId(sessionId),
    })

    if (!session) {
      session = await db.collection("interviews").findOne({
        _id: new ObjectId(sessionId),
        userId: new ObjectId(user.userId),
      })
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get user email from resume data or user doc
    const recipientEmail = session.resumeData?.email || userDoc.email
    if (!recipientEmail) {
      return NextResponse.json({ error: "No email address found" }, { status: 400 })
    }

    const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/results/${sessionId}`

    await sendEmail({
      to: recipientEmail,
      subject: `Your SeemaIQ Interview Results - ${session.role || "Interview"} Round Complete`,
      html: getInterviewCompletionEmailTemplate(session.resumeData?.name || userDoc.name, 8.5, session.role || "interview", resultsUrl),
    })

    // Mark email as sent in sessions collection
    await db.collection("sessions").updateOne(
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
