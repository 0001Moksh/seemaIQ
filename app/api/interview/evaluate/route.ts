import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const { sessionId, round, role } = await request.json()

    if (!sessionId || !round || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { db } = await connectToDatabase()

    // Get session data to retrieve answers and questions
    const session = await db.collection("interview_sessions").findOne({ _id: sessionId })
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Get all Q&A pairs for this round
    const answers = session.answers.filter((a: any) => a.round === round) || []
    const questionsText = answers.map((a: any) => `Q: ${a.question}\nA: ${a.userAnswer}`).join("\n\n")

    // AI evaluation using Gemini
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY not configured" }, { status: 500 })
    }
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-exp" })

    const evaluationPrompt = `You are an expert interview evaluator. Evaluate the following interview responses for a ${role.toUpperCase()} round and provide a JSON response.

${questionsText}

Provide scores (0-100) for:
- Communication: Clarity and articulation of ideas
- Technical: Technical knowledge and depth
- Confidence: Self-assurance and delivery
- Relevance: How well answers address the questions

Also provide 2 specific, actionable improvement tips.

Return a valid JSON object (no markdown, just JSON) with this structure:
{
  "scores": {
    "communication": <number>,
    "technical": <number>,
    "confidence": <number>,
    "relevance": <number>
  },
  "averageScore": <number>,
  "improvementTips": ["tip1", "tip2"]
}`

    const result = await model.generateContent(evaluationPrompt)
    const responseText = result.response.text()
    
    // Parse JSON from response
    let evaluation
    try {
      evaluation = JSON.parse(responseText)
    } catch {
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("Could not parse evaluation response")
      }
    }

    // Save evaluation scores
    await db.collection("interview_sessions").updateOne(
      { _id: sessionId },
      {
        $set: {
          [`roundScores.${round}`]: evaluation.scores,
          [`roundAverage.${round}`]: evaluation.averageScore,
        },
      }
    )

    return NextResponse.json({
      scores: evaluation.scores,
      averageScore: evaluation.averageScore,
      improvementTips: evaluation.improvementTips,
    })
  } catch (error: any) {
    console.error("Evaluation error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
