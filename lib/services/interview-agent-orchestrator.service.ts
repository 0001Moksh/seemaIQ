type InterviewRole = "hr" | "technical" | "manager"

export interface ConversationMemory {
  discussedTopics: string[]
  mentionedTechnologies: string[]
  weakAreas: string[]
  strengths: string[]
  confidenceTrend: number[]
  lastAnswerQuality: number | null
  followUpDepth: number
  adaptiveDifficulty: "supportive" | "balanced" | "advanced"
  notes: string[]
}

export interface AnswerEvaluation {
  clarity: number
  relevance: number
  completeness: number
  confidence: number
  feedback: string
}

export class InterviewAgentOrchestrator {
  static createInitialMemory(experience?: string): ConversationMemory {
    return {
      discussedTopics: [],
      mentionedTechnologies: [],
      weakAreas: [],
      strengths: [],
      confidenceTrend: [],
      lastAnswerQuality: null,
      followUpDepth: 0,
      adaptiveDifficulty: experience === "senior" ? "advanced" : experience === "junior" ? "supportive" : "balanced",
      notes: [],
    }
  }

  static updateMemoryFromAnswer(memory: Partial<ConversationMemory> | null | undefined, input: {
    answer: string
    evaluation: AnswerEvaluation
    question: string
    role: InterviewRole
    domain?: string
  }): ConversationMemory {
    const base = this.createInitialMemory()
    const next: ConversationMemory = {
      ...base,
      ...(memory || {}),
      discussedTopics: [...(memory?.discussedTopics || [])],
      mentionedTechnologies: [...(memory?.mentionedTechnologies || [])],
      weakAreas: [...(memory?.weakAreas || [])],
      strengths: [...(memory?.strengths || [])],
      confidenceTrend: [...(memory?.confidenceTrend || [])],
      notes: [...(memory?.notes || [])],
    }
    const answer = input.answer || ""
    const lower = answer.toLowerCase()
    const technologies = ["react", "next.js", "node", "mongodb", "typescript", "javascript", "python", "aws", "docker", "kubernetes", "sql", "ai", "machine learning"]
      .filter((tech) => lower.includes(tech))

    for (const tech of technologies) {
      if (!next.mentionedTechnologies.includes(tech)) next.mentionedTechnologies.push(tech)
    }

    const score = Math.round((input.evaluation.clarity + input.evaluation.relevance + input.evaluation.completeness + input.evaluation.confidence) / 4)
    next.lastAnswerQuality = score
    next.confidenceTrend.push(input.evaluation.confidence)
    if (next.confidenceTrend.length > 8) next.confidenceTrend = next.confidenceTrend.slice(-8)

    if (input.evaluation.clarity >= 78 && !next.strengths.includes("clear communication")) next.strengths.push("clear communication")
    if (input.evaluation.completeness < 70 && !next.weakAreas.includes("needs more complete examples")) next.weakAreas.push("needs more complete examples")
    if (input.evaluation.confidence < 65 && !next.weakAreas.includes("confidence")) next.weakAreas.push("confidence")

    const topic = input.domain || input.role
    if (topic && !next.discussedTopics.includes(topic)) next.discussedTopics.push(topic)
    next.notes.push(`Q: ${input.question.slice(0, 120)} | Score: ${score}`)
    if (next.notes.length > 12) next.notes = next.notes.slice(-12)

    const recentAverage = next.confidenceTrend.length
      ? next.confidenceTrend.reduce((sum, value) => sum + value, 0) / next.confidenceTrend.length
      : 75
    if (score >= 82 && recentAverage >= 75) next.adaptiveDifficulty = "advanced"
    else if (score < 65 || recentAverage < 60) next.adaptiveDifficulty = "supportive"
    else next.adaptiveDifficulty = "balanced"

    return next
  }

  static shouldAskFollowUp(memory: ConversationMemory, evaluation: AnswerEvaluation, answer: string, finished: boolean): boolean {
    const wordCount = answer.split(/\s+/).filter(Boolean).length

    return (
      !finished &&
      memory.followUpDepth < 1 &&
      (memory.lastAnswerQuality !== null && memory.lastAnswerQuality < 72 || evaluation.completeness < 70 || wordCount < 35)
    )
  }

  static buildRoundTransitionText(role: InterviewRole, memory: Partial<ConversationMemory>) {
    const strengths = memory?.strengths?.length ? `I noticed ${memory.strengths.slice(0, 2).join(" and ")}.` : "You handled this part well."
    const weakArea = memory?.weakAreas?.[0]
    const coaching = weakArea ? `For the next part, try to make your examples a bit more specific around ${weakArea}.` : "Keep your answers structured and specific."

    if (role === "hr") return `${strengths} ${coaching} Great, let's move toward the technical discussion now.`
    if (role === "technical") return `${strengths} ${coaching} Now I'd like to understand your decision-making and ownership style.`
    return `${strengths} ${coaching} We are close to wrapping up.`
  }
}
