import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const { sessionId, round, role } = await request.json()

    if (!sessionId || !round || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = await getDatabase()

    // Get session data to retrieve answers and questions
    const session = await db.collection("interviews").findOne({ _id: new ObjectId(sessionId) })
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Get all Q&A pairs for this round
    const answers = session.answers.filter((a: any) => a.round === round) || []
    const questionsText = answers.map((a: any) => `Q: ${a.question}\nA: ${a.userAnswer}`).join("\n\n")

    // AI evaluation using Gemini (with graceful fallback)
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn("GOOGLE_API_KEY / GEMINI_API_KEY not configured; using fallback evaluation")
    }

    let evaluation: any = null
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

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
        try {
          evaluation = JSON.parse(responseText)
        } catch (e) {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            evaluation = JSON.parse(jsonMatch[0])
          } else {
            throw new Error("Could not parse evaluation response")
          }
        }
      } catch (aiErr) {
        console.error("AI evaluation failed, falling back:", aiErr)
      }
    }

    // If evaluation failed (no API key or AI error), create a deterministic fallback
    if (!evaluation) {
      console.warn("Using deterministic fallback evaluation")
      const defaultScore = 70
      evaluation = {
        scores: {
          communication: defaultScore,
          technical: defaultScore,
          confidence: defaultScore,
          relevance: defaultScore,
        },
        averageScore: defaultScore,
        improvementTips: [
          "Speak clearly and structure your answers with STAR (Situation, Task, Action, Result).",
          "Give one specific example to demonstrate technical depth when applicable.",
        ],
      }
    }

    // Save evaluation scores to interviews collection (persist fallback or AI result)
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          [`roundScores.${round}`]: evaluation.scores,
          [`roundAverage.${round}`]: evaluation.averageScore,
          [`roundImprovement.${round}`]: evaluation.improvementTips,
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
