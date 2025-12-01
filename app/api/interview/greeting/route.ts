import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { buildSystemInstruction } from "@/lib/system-instructions"
import { GoogleGenerativeAI } from "@google/generative-ai"

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
    const session = await db.collection("interviews").findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user.userId),
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const round = Number.parseInt(roundParam)
    const roundRole = round === 1 ? "hr" : round === 2 ? "technical" : "manager"
    const candidateName = session.resumeData?.name?.split(" ")[0] || "candidate"

    // Build system instruction context
    const systemContext = {
      candidateName,
      role: roundRole as "hr" | "technical" | "manager",
      round,
      domain: session.domain || "software",
      resumeData: session.resumeData,
      experienceLevel: session.experience as "junior" | "mid" | "senior",
    }

    // Build comprehensive system instruction
    const systemInstruction = buildSystemInstruction(systemContext)

    // Generate greeting using Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction,
    })

    const greetingPrompt = `Generate a warm, professional greeting for the candidate. This should be the opening statement for the interview round.
The greeting should:
1. Address the candidate by their name (${candidateName})
2. Introduce yourself as the ${roundRole} interviewer
3. Set a positive,
4. Be 2-3 sentences maximum

Generate ONLY the greeting text, nothing else.`

    const result = await model.generateContent(greetingPrompt)
    const greeting = result.response.text().trim()

    // Store greeting in session for reference
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $push: {
          greetings: {
            round,
            text: greeting,
            timestamp: new Date(),
          },
        } as any,
      }
    )

    return NextResponse.json({
      success: true,
      greeting,
      round,
      role: roundRole,
      systemInstruction, // Send system instruction to client for context (optional)
    })
  } catch (error) {
    console.error("Greeting generation error:", error)
    return NextResponse.json({ error: "Failed to generate greeting" }, { status: 500 })
  }
}
