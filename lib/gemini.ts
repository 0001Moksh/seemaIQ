import { GoogleGenerativeAI } from "@google/generative-ai"
import type { ResumeData } from "./resume-parser"
import { buildSystemInstruction, generateFollowUpQuestion, generateFinalFeedback } from "./system-instructions"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function generateInterviewQuestion(
  role: "hr" | "technical" | "manager",
  experience: "junior" | "mid" | "senior",
  round: number,
  previousQuestions: string[] = [],
  resumeData?: ResumeData,
  domain?: string, // ← Yeh naya parameter add kar
): Promise<string> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.7 }
  })

  // Domain mapping (exactly as in your frontend)
  const domainDescriptions: Record<string, string> = {
    software: "Software Engineering (Web, Mobile, Frontend, Backend, Full-Stack Development)",
    data: "Data Science & AI/ML (Python, Machine Learning, Deep Learning, Data Analysis)",
    product: "Product Management (Feature Planning, Team Management, User Research, Growth)",
    design: "UI/UX Design (User Flows, Prototyping, Figma, Design Systems)",
    devops: "DevOps & Cloud Engineering (AWS, Docker, Kubernetes, CI/CD, Infrastructure)",
    other: "General Roles (Sales, Marketing, HR, Operations, Support etc.)"
  }

  const domainDesc = domain ? domainDescriptions[domain] || domainDescriptions.other : "a professional role";

  // If no domain provided, try to infer from resumeData (skills / projects / experience)
  if (!domain && resumeData) {
    const keywords = [
      ...(resumeData.skills || []),
      ...(resumeData.projects ? resumeData.projects.flatMap(p => [p.name, p.description]) : []),
      ...(resumeData.experience ? resumeData.experience.flatMap(e => [e.position, e.company]) : [])
    ].join(" ").toLowerCase()

    if (/react|next|frontend|javascript|typescript|css|tailwind/.test(keywords)) domain = "software"
    else if (/python|pandas|numpy|ml|machine learning|data science|tensorflow|pytorch/.test(keywords)) domain = "data"
    else if (/product|roadmap|pm |product manager|user research|feature/.test(keywords)) domain = "product"
    else if (/ux|ui|figma|design|prototyp|user research/.test(keywords)) domain = "design"
    else if (/aws|kubernetes|docker|devops|ci\/cd|terraform/.test(keywords)) domain = "devops"
    else domain = "other"
  }

  // Fallback questions if Gemini fails
  const fallbackQuestions = {
    hr: [
      `${resumeData?.name ? resumeData.name.split(" ")[0] : "Candidate"}, walk me through your background and what led you to pursue ${domainDesc.toLowerCase()}.`,
      `Tell me about yourself and why you're passionate about ${domainDesc.toLowerCase()}.`,
      `Give me a quick overview of your journey so far in ${domainDesc.toLowerCase()}.`,
      `Hi ${resumeData?.name || ""}, can you start by introducing yourself and your experience in ${domainDesc.toLowerCase()}?`,
      `Please tell us about your professional background and current expertise in ${domainDesc.toLowerCase()}.`
    ],
    technical: [
      `Explain a challenging technical problem you solved in your recent ${domainDesc.toLowerCase()} project.`,
      `How do you approach debugging or optimizing performance in your domain?`,
      `What’s your favorite project you've built in ${domainDesc.toLowerCase()} and why?`
    ],
    manager: [
      `How do you prioritize tasks when managing multiple stakeholders in ${domainDesc.toLowerCase()}?`,
      `Tell me about a time you led a team through a tough deadline.`
    ]
  }

  // HR Round 1 → Always intro question
  if (role === "hr" && round === 1) {
    const introPrompt = `Generate a professional "Tell me about yourself" style opening question for an HR interview.
Candidate is applying for: ${domainDesc}
Experience level: ${experience}
${resumeData?.name ? `Candidate name: ${resumeData.name}` : ""}

Make it natural, warm, and domain-relevant.
Examples:
- "Hi ${resumeData?.name || "there"}, could you please walk me through your background and what excites you about ${domainDesc.toLowerCase()}?"
- "Start by telling me about your journey so far in ${domainDesc.toLowerCase()}."

Return only the question. Nothing else.`

    try {
      const result = await model.generateContent(introPrompt)
      const question = result.response.text().trim()
      if (question && question.length > 20 && !question.includes("**")) return question
    } catch (err) {
      console.warn("Gemini failed for HR intro, using fallback")
    }
  }

  // Normal flow with strong domain context
  const resumeContext = resumeData ? buildResumeContext(role, resumeData, domainDesc) : ""

  const prompt = `You are an expert ${role.toUpperCase()} interviewer conducting Round ${round} of a 3-round interview.

Candidate Profile:
- Domain: ${domainDesc}
- Experience Level: ${experience}
- Has Resume: ${!!resumeData}
${resumeContext}

${previousQuestions.length > 0 ? `Avoid repeating these topics: ${previousQuestions.join(", ")}` : ""}

${role === "hr" && round === 1 ? "This is the very first question. It MUST be a variant of 'Tell me about yourself' but tailored to their domain and experience." : ""}

Generate ONE clear, professional, open-ended interview question.
Rules:
- Make it relevant to ${domainDesc}
- Use simple English
- No bullet points, no numbering, no symbols like @#$
- Question only. No explanation.

Question:`

  try {
    const result = await model.generateContent(prompt)
    let question = result.response.text().trim()

    // Clean any markdown or garbage
    question = question.replace(/[\*#_`]/g, "").trim()
    if (question.toLowerCase().startsWith("question:")) {
      question = question.slice(9).trim()
    }

    if (question && question.length > 15) {
      return question
    }
  } catch (error) {
    console.error("Gemini completely failed:", error)
  }

  // Final Fallback with Name + Domain
  const fallbackList = role === "hr" ? fallbackQuestions.hr : 
                      role === "technical" ? fallbackQuestions.technical : 
                      fallbackQuestions.manager

  const fallback = fallbackList[Math.floor(Math.random() * fallbackList.length)]
  return fallback.replace("Candidate", resumeData?.name?.split(" ")[0] || "there")
}

// Updated buildResumeContext to include domain
function buildResumeContext(role: string, resumeData: ResumeData, domainDesc: string): string {
  if (role === "hr") {
    return `
Domain: ${domainDesc}
Soft Skills Focus: Communication, teamwork, motivation, career goals
Key Points from Resume:
- Experience: ${resumeData.experience.map(e => `${e.title} at ${e.company}`).join(" → ")}
- Skills: ${resumeData.skills.slice(0, 8).join(", ")}
- Summary: ${resumeData.summary || "Not provided"}`
  }

  if (role === "technical") {
    return `
Technical Domain: ${domainDesc}
Focus on: Projects, technologies, problem-solving, architecture
From Resume:
- Skills: ${resumeData.skills.join(", ")}
- Projects: ${resumeData.projects.map(p => p.name).join(", ") || "None listed"}
- Recent Roles: ${resumeData.experience.slice(0, 2).map(e => e.title).join(", ")}`
  }

  return ""
}

export async function evaluateInterviewAnswer(
  question: string,
  answer: string,
  role: "hr" | "technical" | "manager",
): Promise<{
  clarity: number
  relevance: number
  completeness: number
  confidence: number
  feedback: string
}> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  const prompt = `You are an expert ${role} interviewer evaluating a candidate's response.

Question: "${question}"
Answer: "${answer}"

Please evaluate this answer on the following criteria (0-100 scale):
1. Clarity: How clear and articulate is the response?
2. Relevance: How relevant is the response to the question?
3. Completeness: How complete and thorough is the response?
4. Confidence: How confident does the candidate sound?

Provide your evaluation in the following JSON format:
{
  "clarity": <number 0-100>,
  "relevance": <number 0-100>,
  "completeness": <number 0-100>,
  "confidence": <number 0-100>,
  "feedback": "<brief constructive feedback>"
}

Respond with only valid JSON, no additional text.`

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No JSON found in response")
    }

    const evaluation = JSON.parse(jsonMatch[0])

    return {
      clarity: Math.min(100, Math.max(0, evaluation.clarity || 0)),
      relevance: Math.min(100, Math.max(0, evaluation.relevance || 0)),
      completeness: Math.min(100, Math.max(0, evaluation.completeness || 0)),
      confidence: Math.min(100, Math.max(0, evaluation.confidence || 0)),
      feedback: evaluation.feedback || "Good response",
    }
  } catch (error) {
    console.error("Error parsing Gemini response:", error)
    // Return default scores if parsing fails
    return {
      clarity: 75,
      relevance: 75,
      completeness: 75,
      confidence: 75,
      feedback: "Unable to parse detailed feedback",
    }
  }
}

export { buildSystemInstruction, generateFollowUpQuestion, generateFinalFeedback }

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  // For now, return placeholder
  // In production, integrate with Google Cloud Speech-to-Text
  console.log("Transcribing audio buffer of size:", audioBuffer.length)
  return "This is a transcribed response from the candidate"
}
