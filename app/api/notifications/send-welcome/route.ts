import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { sendEmail, getWelcomeEmailTemplate } from "@/lib/email"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDatabase()
    const userDoc = await db.collection("users").findOne({
      _id: new ObjectId(user.userId),
    })

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await sendEmail({
      to: userDoc.email,
      subject: "Welcome to SeemaIQ - Your AI Interview Coach",
      html: getWelcomeEmailTemplate(userDoc.name),
    })

    // Mark email as sent in database
    await db.collection("users").updateOne(
      { _id: new ObjectId(user.userId) },
      {
        $set: {
          welcomeEmailSent: true,
          welcomeEmailSentAt: new Date(),
        },
      },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Send welcome email error:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
