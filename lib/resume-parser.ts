export interface ResumeData {
  name: string
  email: string
  phone: string
  linkedin?: string
  github?: string
  portfolio?: string
  location?: string
  summary: string
  skills: string[]
  experience: Array<{
    company: string
    position: string
    duration: string
    responsibilities: string[]
    achievements: string[]
  }>
  education: Array<{
    school: string
    degree: string
    field: string
    year: string
  }>
  projects: Array<{
    name: string
    description: string
    technologies: string[]
  }>
  certifications: string[]
}

export async function parseResumeFile(file: File): Promise<ResumeData> {
  try {
    const buffer = await file.arrayBuffer()
    let text = ""

    // Attempt to extract text from PDF using pdf-parse (server-side). If not available,
    // fall back to a small placeholder so the AI prompt still runs.
    if (file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf")) {
      try {
        // @ts-ignore - pdf-parse lacks complete types but works at runtime
        const pdfParse = await import("pdf-parse")
        const data = await pdfParse.default(Buffer.from(buffer))
        text = (data && data.text) ? String(data.text).trim().substring(0, 20000) : `[PDF Resume - ${file.name}]`
      } catch (err) {
        console.warn("pdf-parse not available or failed, falling back to placeholder", err)
        text = `[PDF Resume - ${file.name}] File size: ${buffer.byteLength} bytes`
      }
    } else if (
      file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name?.toLowerCase().endsWith(".docx") ||
      file.name?.toLowerCase().endsWith(".doc")
    ) {
      // For DOCX use mammoth to extract text (better fidelity). For DOC fallback to a raw decode.
      try {
        const mammoth = await import("mammoth")
        // mammoth expects a Buffer or ArrayBuffer
        const res = await mammoth.extractRawText({ buffer: Buffer.from(buffer) as any })
        text = res && res.value ? String(res.value).trim().substring(0, 20000) : `[DOCX Resume - ${file.name}]`
      } catch (err) {
        console.warn("mammoth not available or failed, falling back to raw decode", err)
        // Fallback for older .doc files or when mammoth isn't installed
        try {
          text = new TextDecoder().decode(buffer).substring(0, 20000)
        } catch (e) {
          text = `[Resume - ${file.name}] File size: ${buffer.byteLength} bytes`
        }
      }
    } else {
      throw new Error("Unsupported file format. Please use PDF, DOC, or DOCX.")
    }

    return await extractResumeData(text)
  } catch (error) {
    console.error("Error parsing resume:", error)
    throw error
  }
}

async function extractResumeData(text: string): Promise<ResumeData> {
  // If no API key is configured, or if Gemini fails, fall back to a lightweight local extractor.
  const fallbackExtract = (input: string): ResumeData => {
    // Basic regex-based extraction for common contact fields
    const emailMatch = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const phoneMatch = input.match(/\+?\d[\d ()-]{6,}\d/)
    // Heuristic for name: first non-empty line with letters and spaces, up to 4 words
    const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    let name = "Not provided"
    if (lines.length > 0) {
      const candidate = lines[0]
      if (candidate.split(" ").length <= 4 && /[A-Za-z]/.test(candidate)) {
        name = candidate
      }
    }

    return {
      name,
      email: emailMatch ? emailMatch[0] : "Not provided",
      phone: phoneMatch ? phoneMatch[0] : "Not provided",
      linkedin: "",
      github: "",
      portfolio: "",
      location: "",
      summary: lines.slice(0, 3).join(' '),
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set — using local resume fallback extractor")
    return fallbackExtract(text)
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `Extract structured information from this resume text and return as JSON.
Extract the following fields:
- name: Full name
- email: Email address
- phone: Phone number
- linkedin: LinkedIn profile URL or username
- github: GitHub profile URL or username
- portfolio: Portfolio website URL
- location: City, State/Country
- summary: Brief professional summary (2-3 sentences)
- skills: Array of skills
- experience: Array with company, job Title, duration
- education: Array with school, degree, field, year
- projects: Array with name, description, technologies (array)
- certifications: Array of certifications

Resume Text:
${text}

Return ONLY valid JSON, no markdown or extra text.`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn("Gemini returned no JSON — falling back to local extractor")
      return fallbackExtract(text)
    }

    const resumeData = JSON.parse(jsonMatch[0]) as ResumeData

    // Ensure all required fields exist (including contact fields)
    return {
      name: resumeData.name || "Not provided",
      email: resumeData.email || "Not provided",
      phone: resumeData.phone || "Not provided",
      linkedin: resumeData.linkedin || "",
      github: resumeData.github || "",
      portfolio: resumeData.portfolio || "",
      location: resumeData.location || "",
      summary: resumeData.summary || "Not provided",
      skills: resumeData.skills || [],
      experience: resumeData.experience || [],
      education: resumeData.education || [],
      projects: resumeData.projects || [],
      certifications: resumeData.certifications || [],
    }
  } catch (error) {
    console.error("Gemini resume extraction failed — using fallback. Error:", error)
    return fallbackExtract(text)
  }
}
