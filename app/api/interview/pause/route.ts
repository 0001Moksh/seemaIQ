import { NextResponse } from "next/server"
import { InterviewService } from "@/lib/services/interview.service"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = body?.sessionId

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    try {
      await InterviewService.pauseSession(sessionId)
      return NextResponse.json({ success: true }, { status: 200 })
    } catch (err: any) {
      if (err?.message?.includes("Session not found")) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      console.error("Failed to pause session", err)
      return NextResponse.json({ error: "Failed to pause session" }, { status: 500 })
    }
  } catch (err) {
    console.error("Invalid JSON in pause request", err)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
}
