import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { evaluateInterviewAnswer, transcribeAudio, generateInterviewQuestion } from "@/lib/gemini"
import fs from "fs"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const sessionId = formData.get("sessionId") as string
    const questionId = formData.get("questionId") as string
    const audio = formData.get("audio") as Blob
    const video = formData.get("video") as Blob | null

    if (!sessionId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = await getDatabase()
    const session = await db.collection("interviews").findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(user.userId),
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Handle audio - if no audio provided, use empty transcription
    let audioBuffer: Buffer | null = null
    let transcription = ""
    const userAnswerFromForm = formData.get("userAnswer") as string
    
    if (audio) {
      try {
        audioBuffer = Buffer.from(await audio.arrayBuffer())
        transcription = await transcribeAudio(audioBuffer)
      } catch (err) {
        console.error("Error processing audio:", err)
        transcription = ""
      }
    }

    // Use form answer if provided, otherwise use transcription
    const finalAnswer = userAnswerFromForm || transcription

    // If video provided, save to public/videos and include URL in the DB
    let videoUrl: string | null = null
    if (video) {
      try {
        const videoBuffer = Buffer.from(await (video as Blob).arrayBuffer())
        const videosDir = path.join(process.cwd(), "public", "videos")
        await fs.promises.mkdir(videosDir, { recursive: true })
        const filename = `${sessionId}-${Date.now()}.webm`
        const filePath = path.join(videosDir, filename)
        await fs.promises.writeFile(filePath, videoBuffer)
        videoUrl = `/videos/${filename}`
      } catch (err) {
        console.error("Failed to save video:", err)
      }
    }

    // Find the current question
    const currentQuestion = session.questions?.[session.questions.length - 1]?.text || ""

    const evaluation = await evaluateInterviewAnswer(currentQuestion, finalAnswer, session.role)

    // Compute numeric score for this answer (average of evaluation fields)
    const answerScore = Math.round(
      ((evaluation.clarity || 0) + (evaluation.relevance || 0) + (evaluation.completeness || 0) + (evaluation.confidence || 0)) / 4,
    )

    // Store answer in database and update accumulated score and round
    const answerDoc: any = {
      questionId,
      text: finalAnswer,
      evaluation,
      score: answerScore,
      timestamp: new Date(),
    }

    if (videoUrl) {
      answerDoc.videoUrl = videoUrl
    }

    const updateObj: any = {
      $push: {
        answers: answerDoc,
      },
      $inc: { accumulatedScore: answerScore },
    }

    await db.collection("interviews").updateOne({ _id: new ObjectId(sessionId) }, updateObj)

    // Fetch updated session to determine progress
    const updatedSession = await db.collection("interviews").findOne({ _id: new ObjectId(sessionId) })

    // Determine total answers so far and map to current round (5 questions per round)
    const totalAnswers = (updatedSession?.answers || []).length
    const currentRoundFromAnswers = Math.min(3, Math.max(1, Math.ceil(totalAnswers / 5)))

    // Count how many answers have been recorded in the current round
    const answersInThisRound = totalAnswers - (currentRoundFromAnswers - 1) * 5

    if (answersInThisRound < 5) {
      // Continue same round: fetch next question for currentRoundFromAnswers
      const previousQuestions = updatedSession?.questions?.map((q: any) => q.text) || []
      const roleToUse = updatedSession?.role || session.role
      const experienceToUse = updatedSession?.experience || session.experience
      const resumeToUse = updatedSession?.resumeData || session.resumeData || null
      const nextQuestion = await generateInterviewQuestion(
        roleToUse,
        experienceToUse,
        currentRoundFromAnswers,
        previousQuestions,
        resumeToUse,
      )

      return NextResponse.json({
        success: true,
        nextRound: currentRoundFromAnswers,
        question: {
          id: Math.random().toString(),
          text: nextQuestion,
          round: currentRoundFromAnswers,
          role: roleToUse,
          experience: experienceToUse,
        },
      })
    } else {
      // This round has finished (answersInThisRound >= 5)
      if (currentRoundFromAnswers < 3) {
        // Not the final round — signal round completion to the client so it can show break and start next round
        return NextResponse.json({ success: true, roundComplete: true, finishedRound: currentRoundFromAnswers, nextRound: currentRoundFromAnswers + 1 })
      }

      // Final round finished — compute final score and mark session completed
      let finalScore = 0
      if (typeof updatedSession?.accumulatedScore === "number" && Array.isArray(updatedSession?.answers) && updatedSession.answers.length > 0) {
        finalScore = Math.round((updatedSession.accumulatedScore) / updatedSession.answers.length)
      } else {
        const allAnswers = (updatedSession?.answers || []).concat([
          {
            questionId,
            text: transcription,
            evaluation,
          },
        ])
        finalScore = calculateFinalScore(allAnswers)
      }

      // Update session as completed
      await db.collection("interviews").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: "completed",
            finalScore,
            completedAt: new Date(),
          },
        },
      )

      // Update user stats
      await db.collection("users").updateOne(
        { _id: new ObjectId(user.userId) },
        {
          $inc: {
            "stats.totalInterviews": 1,
            "stats.totalScore": finalScore,
          },
        },
      )

      return NextResponse.json({ success: true, completed: true, finalScore })
    }
  } catch (error) {
    console.error("Submit answer error:", error)
    return NextResponse.json({ error: "Failed to submit answer" }, { status: 500 })
  }
}

function calculateFinalScore(answers: Array<{ evaluation: any }>): number {
  if (answers.length === 0) return 0

  let totalScore = 0
  answers.forEach((answer) => {
    const score =
      (answer.evaluation.clarity +
        answer.evaluation.relevance +
        answer.evaluation.completeness +
        answer.evaluation.confidence) /
      4
    totalScore += score
  })

  return Math.round(totalScore / answers.length)
}
