import { NextResponse } from "next/server"
import { InterviewService } from "@/lib/services/interview.service"
import { logger } from "@/lib/services/logger.service"

/**
 * POST /api/interview/session/create
 * Create a new interview session
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { userId, resumeData, role = 'hr', experience = 'mid', questionsPerRound = 5 } = body

    if (!userId) {
      logger.warn("Session creation failed: Missing userId", { endpoint: "/api/interview/session/create" })
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Use centralized service layer
    const sessionId = await InterviewService.createSession({
      userId,
      resumeData,
      role,
      experience,
      questionsPerRound,
    })

    const duration = Date.now() - startTime
    logger.info("Session created successfully", { 
      sessionId, 
      userId, 
      role,
      duration 
    })

    return NextResponse.json({ success: true, sessionId })
  } catch (err) {
    const duration = Date.now() - startTime
    logger.error("Create session error", { duration }, err as Error)
    
    return NextResponse.json(
      { 
        error: 'Failed to create session',
        message: process.env.NODE_ENV === "development" ? (err as Error).message : undefined
      }, 
      { status: 500 }
    )
  }
}
