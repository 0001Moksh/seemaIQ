/**
 * Interview Service Layer
 * Centralized business logic for interview operations
 * Industry-standard service pattern with proper error handling and caching
 */

import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { cache } from "./cache.service"

export interface InterviewSession {
  _id?: ObjectId
  userId: ObjectId
  resumeData: any
  domain?: string
  language?: "english" | "hindi"
  persona?: string
  conversationMemory?: any
  role: string
  experience: string
  questionsPerRound: number
  currentRound: number
  questionIndex: number
  questions: Array<{
    text: string
    round: number
    questionNum: number
    createdAt: Date
  }>
  answers: Array<{
    question: string
    answer: string
    evaluation: any
    round: number
    createdAt: Date
  }>
  status: "active" | "paused" | "completed"
  finalScore?: number
  roundScores?: Record<number, number>
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  expiresAt: Date
  lastMeta?: any
}

export interface InterviewStats {
  totalInterviews: number
  averageScore: number
  currentStreak: number
  recentInterviews: Array<{
    id: string
    role: string
    date: Date
    score: number
    status: string
    sessionId: string
    roundsCompleted: number
    questionsAnswered: number
  }>
}

export class InterviewService {
  /**
   * Get user interview statistics with caching support
   */
  static async getUserStats(userId: string): Promise<InterviewStats> {
    const cacheKey = `user:${userId}:stats`

    // Try to get from cache first
    return cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const db = await getDatabase()
          const userObjectId = new ObjectId(userId)

          // Fetch all sessions for the user
          const sessions = await db
            .collection<InterviewSession>("sessions")
            .find({ userId: userObjectId })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray()

          const totalInterviews = sessions.length

          // Calculate average score from completed interviews
          const completedSessions = sessions.filter((s) => s.status === "completed" && s.finalScore)
          const averageScore =
            completedSessions.length > 0
              ? Math.round(
                  completedSessions.reduce((sum, s) => sum + (s.finalScore || 0), 0) / completedSessions.length
                )
              : 0

          // Calculate current streak (consecutive days with interviews)
          const currentStreak = this.calculateStreak(sessions)

          // Get recent interviews with proper mapping
          const recentInterviews = sessions.slice(0, 10).map((session) => ({
            id: session._id!.toString(),
            role: session.role,
            date: session.createdAt,
            score: session.finalScore || 0,
            status: session.status,
            sessionId: session._id!.toString(),
            roundsCompleted: Math.max(0, (session.currentRound || 1) - 1),
            questionsAnswered: session.answers?.length || 0,
          }))

          return {
            totalInterviews,
            averageScore,
            currentStreak,
            recentInterviews,
          }
        } catch (error) {
          console.error("Error fetching user stats:", error)
          throw new Error("Failed to fetch interview statistics")
        }
      },
      { ttl: 60 } // Cache for 60 seconds
    )
  }

  /**
   * Calculate streak of consecutive days with interviews
   */
  private static calculateStreak(sessions: InterviewSession[]): number {
    if (!sessions.length) return 0

    const dates = sessions
      .map((s) => {
        const date = new Date(s.createdAt)
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      })
      .sort((a, b) => b - a)

    const uniqueDates = [...new Set(dates)]
    let streak = 1
    const oneDayMs = 24 * 60 * 60 * 1000

    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const diff = uniqueDates[i] - uniqueDates[i + 1]
      if (diff === oneDayMs) {
        streak++
      } else {
        break
      }
    }

    return streak
  }

  /**
   * Create a new interview session
   */
  static async createSession(data: {
    userId: string
    resumeData?: any
    domain?: string
    language?: "english" | "hindi"
    persona?: string
    role?: string
    experience?: string
    questionsPerRound?: number
  }): Promise<string> {
    try {
      const db = await getDatabase()

      const domain = data.domain || data.resumeData?.domain || ""
      const resumeData = data.resumeData ? { ...data.resumeData, domain } : null
      const session: Partial<InterviewSession> = {
        userId: new ObjectId(data.userId),
        resumeData,
        domain,
        language: data.language || "english",
        persona: data.persona || "friendly-recruiter",
        conversationMemory: {
          discussedTopics: [],
          mentionedTechnologies: [],
          weakAreas: [],
          strengths: [],
          confidenceTrend: [],
          lastAnswerQuality: null,
          followUpDepth: 0,
          adaptiveDifficulty: data.experience === "senior" ? "advanced" : data.experience === "junior" ? "supportive" : "balanced",
          notes: [],
        },
        role: data.role || "hr",
        experience: data.experience || "mid",
        questionsPerRound: data.questionsPerRound || 5,
        currentRound: 1,
        questionIndex: 0,
        questions: [],
        answers: [],
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      }

      const result = await db.collection("sessions").insertOne(session)
      return result.insertedId.toString()
    } catch (error) {
      console.error("Error creating session:", error)
      throw new Error("Failed to create interview session")
    }
  }

  /**
   * Update session with new question
   */
  static async addQuestion(
    sessionId: string,
    question: {
      text: string
      round: number
      questionNum: number
    }
  ): Promise<void> {
    try {
      const db = await getDatabase()

      await db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            questionIndex: question.questionNum,
            updatedAt: new Date(),
          },
          $push: {
            questions: {
              ...question,
              createdAt: new Date(),
            },
          } as any,
        }
      )
    } catch (error) {
      console.error("Error adding question:", error)
      throw new Error("Failed to add question to session")
    }
  }

  /**
   * Add answer and evaluation to session
   */
  static async addAnswer(
    sessionId: string,
    answer: {
      question: string
      answer: string
      evaluation: any
      round: number
    }
  ): Promise<void> {
    try {
      const db = await getDatabase()

      const session = await db.collection<InterviewSession>("sessions").findOne({
        _id: new ObjectId(sessionId),
      })

      if (!session) {
        throw new Error("Session not found")
      }

      const completedCount = (session.answers?.length || 0) + 1

      await db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $push: {
            answers: {
              ...answer,
              createdAt: new Date(),
            },
          } as any,
          $set: {
            questionIndex: completedCount,
            updatedAt: new Date(),
          },
        }
      )

      // Invalidate user stats cache
      cache.delete(`user:${session.userId.toString()}:stats`)
    } catch (error) {
      console.error("Error adding answer:", error)
      throw new Error("Failed to add answer to session")
    }
  }

  static async updateConversationMemory(sessionId: string, memory: any): Promise<void> {
    try {
      const db = await getDatabase()

      await db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            conversationMemory: memory,
            updatedAt: new Date(),
          },
        }
      )
    } catch (error) {
      console.error("Error updating conversation memory:", error)
      throw new Error("Failed to update conversation memory")
    }
  }

  /**
   * Complete an interview session
   */
  static async completeSession(sessionId: string): Promise<void> {
    try {
      const db = await getDatabase()

      const session = await db.collection<InterviewSession>("sessions").findOne({
        _id: new ObjectId(sessionId),
      })

      if (!session) {
        throw new Error("Session not found")
      }

      // Calculate final score
      const scores = session.answers?.map((a) => {
        const evaluation = a.evaluation
        return Math.round((evaluation.clarity + evaluation.relevance + evaluation.completeness + evaluation.confidence) / 4)
      }) || []

      const finalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

      await db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: "completed",
            finalScore,
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      )

      // Invalidate user stats cache
      cache.delete(`user:${session.userId.toString()}:stats`)
    } catch (error) {
      console.error("Error completing session:", error)
      throw new Error("Failed to complete interview session")
    }
  }

  /**
   * Pause an interview session
   */
  static async pauseSession(sessionId: string): Promise<void> {
    try {
      const db = await getDatabase()

      const session = await db.collection<InterviewSession>("sessions").findOne({
        _id: new ObjectId(sessionId),
      })

      if (!session) {
        throw new Error("Session not found")
      }

      await db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: "paused",
            updatedAt: new Date(),
          },
        }
      )

      // Invalidate user stats cache
      cache.delete(`user:${session.userId.toString()}:stats`)
    } catch (error) {
      console.error("Error pausing session:", error)
      throw new Error("Failed to pause interview session")
    }
  }

  /**
   * Resume a paused interview session
   */
  static async resumeSession(sessionId: string): Promise<void> {
    try {
      const db = await getDatabase()

      await db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: "active",
            updatedAt: new Date(),
          },
        }
      )
    } catch (error) {
      console.error("Error resuming session:", error)
      throw new Error("Failed to resume interview session")
    }
  }

  /**
   * Get session by ID
   */
  static async getSession(sessionId: string): Promise<InterviewSession | null> {
    try {
      const db = await getDatabase()

      const session = await db.collection<InterviewSession>("sessions").findOne({
        _id: new ObjectId(sessionId),
      })

      return session
    } catch (error) {
      console.error("Error fetching session:", error)
      throw new Error("Failed to fetch interview session")
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getActiveSessions(userId: string): Promise<InterviewSession[]> {
    try {
      const db = await getDatabase()

      const sessions = await db
        .collection<InterviewSession>("sessions")
        .find({
          userId: new ObjectId(userId),
          status: { $in: ["active", "paused"] },
        })
        .sort({ updatedAt: -1 })
        .toArray()

      return sessions
    } catch (error) {
      console.error("Error fetching active sessions:", error)
      throw new Error("Failed to fetch active interview sessions")
    }
  }
}
