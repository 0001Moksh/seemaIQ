import type { ResumeData } from "./resume-parser"

export interface SystemInstructionContext {
  candidateName: string
  role: "hr" | "technical" | "manager"
  round: number
  domain: string
  resumeData?: ResumeData
  experienceLevel: "junior" | "mid" | "senior"
}

/**
 * Builds a comprehensive system instruction for Gemini API
 * This instruction is used for the entire conversation in a round
 */
export function buildSystemInstruction(context: SystemInstructionContext): string {
  const { candidateName, role, round, domain, resumeData, experienceLevel } = context

  const rolePersonality = getRolePersonality(role)
  const resumeContext = resumeData ? `Skills: ${resumeData.skills?.slice(0, 5).join(", ")}` : ""

  return `You are a professional ${role.toUpperCase()} interviewer.

CANDIDATE: ${candidateName} (${domain}, ${experienceLevel} level)
${resumeContext}

ROLE: ${rolePersonality}

INSTRUCTIONS:
- Ask 1 clear, concise question at a time
- Keep questions short and natural
- NO bullet points, NO markdown, NO formatting
- Listen to answers and ask follow-ups when needed
- Be professional and encouraging
- Only output the question (nothing else)`
}

function getRolePersonality(role: "hr" | "technical" | "manager"): string {
  const personalities: Record<string, string> = {
    hr: `- You are warm, approachable, and focused on understanding the candidate's soft skills, motivation, and cultural fit.
- Ask about their career goals, team collaboration, conflict resolution, and passion for the domain.
- Assess communication, interpersonal skills, and adaptability.
- Be empathetic and encouraging throughout the conversation.`,
    technical: `- You are analytical, detail-oriented, and focused on technical depth and problem-solving.
- Ask about their technical projects, architecture decisions, coding practices, and challenges they overcame.
- Dig into their problem-solving approach and how they debug issues.
- Be precise and thorough; don't settle for surface-level answers.`,
    manager: `- You are strategic, leader-focused, and interested in how candidates manage teams, prioritize work, and make decisions.
- Ask about their leadership experience, team management, handling difficult situations, and scaling challenges.
- Assess their ability to mentor, delegate, and handle conflict.
- Be executive-level in your questions; focus on impact and outcomes.`,
  }
  return personalities[role] || personalities.hr
}

function getRoleTitle(role: "hr" | "technical" | "manager"): string {
  const titles: Record<string, string> = {
    hr: "your HR interviewer",
    technical: "your technical interviewer",
    manager: "your manager-level interviewer",
  }
  return titles[role] || "your interviewer"
}

function getAssessmentFocus(role: "hr" | "technical" | "manager"): string {
  const focus: Record<string, string> = {
    hr: "soft skills, communication, cultural fit, and motivation",
    technical: "technical depth, problem-solving, and architectural thinking",
    manager: "leadership, decision-making, and team management",
  }
  return focus[role] || "overall fit"
}

function getInterviewingStyle(role: "hr" | "technical" | "manager", exp: string): string {
  const styles: Record<string, Record<string, string>> = {
    hr: {
      junior: `- Start with foundational questions about their background and journey.
   - Be encouraging; help them see the value in their experience.
   - Focus on learning mindset and growth potential.`,
      mid: `- Ask about their evolution and lessons learned.
   - Explore how they've grown and taken on more responsibility.
   - Assess their ability to mentor others.`,
      senior: `- Focus on strategic impact and influence.
   - Ask about mentoring, scaling, and organizational contributions.
   - Understand their vision for their career.`,
    },
    technical: {
      junior: `- Start with fundamentals and build complexity.
   - Help them think through problems step-by-step.
   - Encourage them to explain their reasoning.`,
      mid: `- Ask about architecture and design decisions.
   - Explore how they balance trade-offs.
   - Dig into recent projects and technical challenges.`,
      senior: `- Focus on system design, scalability, and technical leadership.
   - Ask about mentoring junior developers.
   - Explore how they stay current with technology.`,
    },
    manager: {
      junior: `- Ask about team collaboration and early leadership experiences.
   - Explore their communication style and conflict resolution.
   - Understand their vision for growth.`,
      mid: `- Focus on team management, project ownership, and decision-making.
   - Ask about handling difficult situations and scaling challenges.
   - Explore their approach to feedback and development.`,
      senior: `- Focus on strategic leadership, stakeholder management, and organizational impact.
   - Ask about building and scaling teams.
   - Explore their vision for the organization and market.`,
    },
  }
  return styles[role]?.[exp] || styles.hr.mid
}

function buildResumeContext(resumeData: ResumeData, domain: string): string {
  const skills = resumeData.skills.slice(0, 10).join(", ")
  const companies = resumeData.experience
    .slice(0, 3)
    .map(e => `${e.title} at ${e.company}`)
    .join(" → ")
  const projects = resumeData.projects.slice(0, 2).map(p => p.name).join(", ")

  return `RESUME SUMMARY:
- Professional Summary: ${resumeData.summary || "Not provided"}
- Key Skills: ${skills}
- Experience: ${companies || "Not specified"}
- Notable Projects: ${projects || "Not specified"}
- Location: ${resumeData.location || "Not specified"}
- Contact: ${resumeData.email || "Not provided"}`
}

/**
 * Generates a follow-up question based on the candidate's answer
 * Used to continue the conversation after each response
 */
export async function generateFollowUpQuestion(
  previousQuestion: string,
  candidateAnswer: string,
  role: "hr" | "technical" | "manager",
  candidateName: string,
  domain: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  const prompt = `You are a ${role} interviewer speaking with ${candidateName} about their ${domain} background.

Previous Question: "${previousQuestion}"
Candidate's Answer: "${candidateAnswer}"

Ask a natural follow-up question that:
- Digs deeper into their response
- Explores their reasoning or approach
- Is concise and conversational
- No bullet points or formatting

Follow-up question (ONLY the question, nothing else):`

  try {
    const result = await model.generateContent(prompt)
    const followUp = result.response.text().trim()
    if (followUp && followUp.length > 10) return followUp
  } catch (error) {
    console.error("Follow-up generation failed:", error)
  }

  // Fallback follow-ups
  const fallbacks: Record<string, string[]> = {
    hr: [
      `Can you tell me more about that experience and what you learned from it?`,
      `How did you handle challenges during that time?`,
      `What was your biggest takeaway from that situation?`,
    ],
    technical: [
      `What approach did you take to solve that problem?`,
      `Can you walk me through your technical decision-making process?`,
      `What would you do differently if you faced that challenge again?`,
    ],
    manager: [
      `How did you approach this from a leadership perspective?`,
      `What was the impact of your decision on the team?`,
      `How would you handle a similar situation differently next time?`,
    ],
  }

  const pool = fallbacks[role] || fallbacks.hr
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Generates feedback and suggestions after all questions are complete
 */
export async function generateFinalFeedback(
  allQuestionsAndAnswers: Array<{ question: string; answer: string }>,
  role: "hr" | "technical" | "manager",
  candidateName: string,
  domain: string,
): Promise<{ strengths: string[]; improvements: string[]; overallFeedback: string }> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai")
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  const conversationText = allQuestionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join("\n\n")

  const prompt = `You are a ${role} interviewer who just conducted a ${role} round interview with ${candidateName} for a ${domain} role.

INTERVIEW TRANSCRIPT:
${conversationText}

Provide constructive feedback in the following JSON format (NO markdown, ONLY valid JSON):
{
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["area to improve 1", "area to improve 2"],
  "overallFeedback": "2-3 sentences of overall assessment"
}

Return ONLY valid JSON, no additional text.`

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error("Feedback generation failed:", error)
  }

  // Fallback feedback
  return {
    strengths: [
      "Good communication and clarity",
      "Shows enthusiasm for the domain",
      "Demonstrates problem-solving skills",
    ],
    improvements: ["Provide more specific examples", "Deepen technical depth", "Consider edge cases more thoroughly"],
    overallFeedback: `${candidateName} showed solid potential in this ${role} round. Focus on deepening your expertise and providing more concrete examples.`,
  }
}
