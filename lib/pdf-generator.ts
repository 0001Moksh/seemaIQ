import { jsPDF } from "jspdf"
import type { ResumeData } from "./resume-parser"

export interface InterviewRoundData {
  round: number
  role: "hr" | "technical" | "manager"
  questionsAndAnswers: Array<{
    question: string
    answer: string
    evaluation?: {
      clarity: number
      relevance: number
      completeness: number
      confidence: number
      feedback: string
    }
  }>
  roundScore: number
  feedback?: {
    strengths: string[]
    improvements: string[]
    overallFeedback: string
  }
}

export interface PDFReportData {
  candidateName: string
  candidateEmail: string
  domain: string
  experienceLevel: "junior" | "mid" | "senior"
  resumeData?: ResumeData
  rounds: InterviewRoundData[]
  finalScore: number
  generatedAt: Date
}

export async function generateInterviewPDF(data: PDFReportData): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let currentY = 20

  const setFont = (size: number, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style)
    doc.setFontSize(size)
  }

  const addText = (text: string, x = 20, y?: number, opts: any = {}) => {
    const textY = y ?? currentY
    doc.text(text, x, textY, opts)
    if (!y) currentY += opts.maxWidth ? 8 : 6
    return textY
  }

  const addLine = () => {
    doc.setDrawColor(200)
    doc.line(20, currentY, pageWidth - 20, currentY)
    currentY += 8
  }

  const checkPageBreak = (space = 30) => {
    if (currentY + space > pageHeight - 20) {
      doc.addPage()
      currentY = 20
    }
  }

  // Header
  setFont(24, "bold")
  addText("Interview Performance Report", 20)
  currentY += 5

  setFont(10)
  addText(`Generated on ${data.generatedAt.toLocaleDateString()}`, 20)
  currentY += 10

  addLine()

  // Candidate Info
  setFont(12, "bold")
  addText("Candidate Information")
  currentY += 8

  setFont(10)
  addText(`Name: ${data.candidateName}`, 30)
  addText(`Email: ${data.candidateEmail}`, 30)
  addText(`Domain: ${data.domain}`, 30)
  addText(`Experience Level: ${data.experienceLevel.toUpperCase()}`, 30)
  currentY += 5

  addLine()

  // Overall Score
  setFont(12, "bold")
  addText("Overall Performance")
  currentY += 8

  setFont(14, "bold")
  const scoreColor = data.finalScore >= 75 ? [34, 139, 34] : data.finalScore >= 50 ? [255, 140, 0] : [220, 20, 60]
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
  addText(`Score: ${Math.round(data.finalScore)}%`, 30)
  doc.setTextColor(0, 0, 0)
  currentY += 8

  // Score breakdown by round
  setFont(10)
  addText("Round-wise Performance:", 30)
  currentY += 4
  data.rounds.forEach((round) => {
    addText(`• Round ${round.round} (${round.role.toUpperCase()}): ${Math.round(round.roundScore)}%`, 35)
  })
  currentY += 8

  addLine()

  // Detailed Feedback per Round
  data.rounds.forEach((round, idx) => {
    checkPageBreak(50)

    setFont(12, "bold")
    addText(`Round ${round.round}: ${round.role.toUpperCase()} Interview`, 20)
    currentY += 5

    setFont(11, "bold")
    addText(`Role Focus: ${round.role === "hr" ? "Soft Skills & Communication" : round.role === "technical" ? "Technical Depth & Problem-Solving" : "Leadership & Decision-Making"}`, 25)
    currentY += 6

    // Questions and Answers
    setFont(11, "bold")
    addText("Conversation:", 25)
    currentY += 4

    round.questionsAndAnswers.forEach((qa, qIdx) => {
      checkPageBreak(40)

      setFont(10, "bold")
      addText(`Q${qIdx + 1}: ${qa.question}`, 30, undefined, { maxWidth: pageWidth - 60 })
      currentY += 5

      setFont(10)
      addText(`A${qIdx + 1}: ${qa.answer}`, 35, undefined, { maxWidth: pageWidth - 70 })
      currentY += 4

      if (qa.evaluation) {
        setFont(9)
        const avgScore = Math.round(
          (qa.evaluation.clarity + qa.evaluation.relevance + qa.evaluation.completeness + qa.evaluation.confidence) / 4
        )
        addText(
          `Evaluation: Clarity ${qa.evaluation.clarity}% | Relevance ${qa.evaluation.relevance}% | Completeness ${qa.evaluation.completeness}% | Confidence ${qa.evaluation.confidence}% (Overall: ${avgScore}%)`,
          40,
          undefined,
          { maxWidth: pageWidth - 80 }
        )
        addText(`Feedback: ${qa.evaluation.feedback}`, 40, undefined, { maxWidth: pageWidth - 80 })
        currentY += 4
      }

      currentY += 2
    })

    // Round Feedback
    if (round.feedback) {
      currentY += 4
      setFont(11, "bold")
      addText("Round Feedback:", 25)
      currentY += 4

      setFont(10, "bold")
      addText("Strengths:", 30)
      round.feedback.strengths.forEach((strength) => {
        setFont(10)
        addText(`• ${strength}`, 35, undefined, { maxWidth: pageWidth - 65 })
      })

      currentY += 2
      setFont(10, "bold")
      addText("Areas for Improvement:", 30)
      round.feedback.improvements.forEach((improvement) => {
        setFont(10)
        addText(`• ${improvement}`, 35, undefined, { maxWidth: pageWidth - 65 })
      })

      currentY += 2
      setFont(10, "bold")
      addText("Overall Assessment:", 30)
      setFont(10)
      addText(round.feedback.overallFeedback, 35, undefined, { maxWidth: pageWidth - 65 })

      currentY += 8
    }

    if (idx < data.rounds.length - 1) {
      addLine()
    }
  })

  // Footer
  checkPageBreak(30)
  addLine()
  setFont(9)
  addText("This report is confidential and intended for the candidate and hiring team only.", 20, undefined, {
    maxWidth: pageWidth - 40,
  })
  addText("For questions or concerns, please contact the HR department.", 20, undefined, { maxWidth: pageWidth - 40 })

  return Buffer.from(doc.output("arraybuffer"))
}
