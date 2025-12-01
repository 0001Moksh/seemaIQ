import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { parseResumeFile } from "@/lib/resume-parser"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const resumeData = await parseResumeFile(file)

    return NextResponse.json(resumeData)
  } catch (error) {
    console.error("Resume parsing error:", error)
    return NextResponse.json({ error: "Failed to parse resume" }, { status: 500 })
  }
}
