import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, resumeData, role = 'hr', experience = 'mid', questionsPerRound = 5 } = body

    const db = await getDatabase()

    const session = {
      userId: userId ? new ObjectId(userId) : null,
      resumeData: resumeData || null,
      role,
      experience,
      questionsPerRound,
      currentRound: 1,
      questionIndex: 0,
      questions: [],
      answers: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    }

    const res = await db.collection('sessions').insertOne(session)
    return NextResponse.json({ success: true, sessionId: res.insertedId.toString() })
  } catch (err) {
    console.error('Create session error:', err)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
