"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"

interface Metric {
  label: string
  score: number
}

interface Answer {
  questionId: string
  text: string
  score: number
  videoUrl?: string
  timestamp: string
}

interface InterviewResult {
  id: string
  finalScore: number
  role: string
  experience: string
  completedAt: string
  metrics: Metric[]
  improvements: string[]
  roundScores: Array<{ round: number; score: number }>
  answers?: Answer[]
}

export default function ResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoggedIn, isLoading } = useAuth()

  const sessionId = searchParams.get("sessionId")
  const [result, setResult] = useState<InterviewResult | null>(null)
  const [isLoadingResult, setIsLoadingResult] = useState(true)
  const printRef = useRef<HTMLDivElement | null>(null)

  const handleDownloadPDF = () => {
    if (!printRef.current) return

    const printContents = printRef.current.innerHTML
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>Interview Results</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #111827; padding: 20px; }
            img { max-width: 160px; height: auto; }
            .w-48 { width: 192px; height: 192px; }
            .text-6xl { font-size: 3.75rem; }
            .text-4xl { font-size: 2.25rem; }
            .text-2xl { font-size: 1.5rem; }
            .text-lg { font-size: 1.125rem; }
            .card { border: 1px solid #e5e7eb; padding: 18px; border-radius: 8px; margin-bottom: 16px; }
            .muted { color: #6b7280; }
            .score-circle { display:flex; align-items:center; justify-content:center; border-radius:9999px; width:192px; height:192px; border:2px solid rgba(59,130,246,0.2); }
            .round { margin-bottom: 12px }
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    // Trigger print — user can choose "Save as PDF"
    printWindow.print()
  }

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/auth/login")
    }
  }, [isLoading, isLoggedIn, router])

  useEffect(() => {
    if (sessionId && isLoggedIn) {
      fetchResults()
    }
  }, [sessionId, isLoggedIn])

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem("authToken")
      const response = await fetch(`/api/interview/results?sessionId=${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data.result)
      }
    } catch (error) {
      console.error("Failed to fetch results:", error)
    } finally {
      setIsLoadingResult(false)
    }
  }

  if (isLoading || !isLoggedIn || isLoadingResult) {
    return (
      <main className="min-h-screen liquid-bg text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </main>
    )
  }

  if (!result) {
    return (
      <main className="min-h-screen liquid-bg text-foreground">
        <header className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <Link href="/">
          <img
              src="/logo.png"
              alt="SeemaIQ Logo"
              className="w-35 h-20 pt-3 rounded-lg object-cover"
            />
            </Link>
        </div>
        </header>
        <header className=" border-border">
          <div className="px-30 py-10 max-w-8xl mx-auto">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                ← Back to Dashboard
              </Button>
            </Link>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-destructive mb-4">Results not found</p>
          <Link href="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </main>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-400"
    if (score >= 70) return "text-yellow-400"
    return "text-orange-400"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return "from-green-500/20 to-green-600/10"
    if (score >= 70) return "from-yellow-500/20 to-yellow-600/10"
    return "from-orange-500/20 to-orange-600/10"
  }

  return (
    <main className="min-h-screen liquid-bg text-foreground">
      {/* Header */}
      <header className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <Link href="/">
          <img
              src="/logo.png"
              alt="SeemaIQ Logo"
              className="w-35 h-20 pt-3 rounded-lg object-cover"
            />
            </Link>
        </div>
      </header>

      {/* Results */}
      <div ref={printRef} className="max-w-6xl mx-auto px-4 py-6">
        <div className="space-y-8">
          {/* Navigation & Download */}
          <div className="max-w-8xl mx-auto flex items-center justify-between">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                ← Back to Dashboard
              </Button>
            </Link>
            <Button 
              onClick={() => window.location.href = `/api/interview/download-pdf?sessionId=${sessionId}`}
              className="bg-primary text-primary-foreground"
            >
              📥 Download PDF Report
            </Button>
          </div>
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Interview Complete!</h1>
            <p className="text-muted-foreground">
              {result.role.charAt(0).toUpperCase() + result.role.slice(1)} Round -{" "}
              {result.experience.charAt(0).toUpperCase() + result.experience.slice(1)} Level
            </p>

            <div className="inline-block mt-8">
              <div
                className={`w-48 h-48 bg-gradient-to-br ${getScoreBgColor(
                  result.finalScore,
                )} rounded-full flex items-center justify-center border-2 border-primary/30`}
              >
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getScoreColor(result.finalScore)}`}>{result.finalScore}</div>
                  <div className="text-lg text-primary-foreground">out of 100</div>
                </div>
              </div>
            </div>

            <p className="text-lg text-muted-foreground mt-4">
              {result.finalScore >= 85
                ? "Excellent performance! You demonstrated strong skills."
                : result.finalScore >= 70
                  ? "Good job! Continue practicing to improve further."
                  : "Keep practicing! You will improve with consistency."}
            </p>
          </div>

          {/* Round Scores & Transcripts */}
          <Card className="p-8 border border-border">
            <h2 className="text-2xl font-bold mb-6">Round-wise Performance & Feedback</h2>
            <div className="space-y-8">
              {result.roundScores.map((round) => (
                <div key={round.round} className="border border-border/50 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-lg">Round {round.round} • {round.round === 1 ? "HR" : round.round === 2 ? "Technical" : "Manager"}</span>
                      <p className="text-sm text-muted-foreground">
                        {round.round === 1 ? "Soft Skills & Communication" : round.round === 2 ? "Technical Depth & Problem-Solving" : "Leadership & Decision-Making"}
                      </p>
                    </div>
                    <span className={`text-3xl font-bold ${getScoreColor(round.score)}`}>{round.score}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary to-accent h-full transition-all"
                      style={{ width: `${round.score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-8 border border-border">
            <h2 className="text-2xl font-bold mb-6">Detailed Metrics</h2>
            <div className="space-y-6">
              {result.metrics.map((metric) => (
                <div key={metric.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{metric.label}</span>
                    <span className={`text-lg font-bold ${getScoreColor(metric.score)}`}>{metric.score}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary to-accent h-full transition-all"
                      style={{ width: `${metric.score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-8 border border-border">
            <h2 className="text-2xl font-bold mb-6">Areas for Improvement</h2>
            <ul className="space-y-3">
              {result.improvements.map((improvement, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-accent">{i + 1}</span>
                  </div>
                  <span className="text-muted-foreground">{improvement}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Video Playback */}
          {result.answers && result.answers.some((a) => a.videoUrl) && (
            <Card className="p-8 border border-border">
              <h2 className="text-2xl font-bold mb-6">Your Recorded Answers</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {result.answers
                  .filter((answer) => answer.videoUrl)
                  .map((answer, idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold">Answer {idx + 1}</span>
                        <span className={`text-sm font-bold px-2 py-1 rounded ${answer.score >= 75 ? "bg-green-500/20 text-green-400" : answer.score >= 60 ? "bg-yellow-500/20 text-yellow-400" : "bg-orange-500/20 text-orange-400"}`}>
                          {answer.score}%
                        </span>
                      </div>
                      <video
                        src={answer.videoUrl}
                        className="w-full rounded-lg bg-secondary border border-border"
                        controls
                        style={{ maxHeight: "300px" }}
                      />
                      <p className="text-sm text-muted-foreground line-clamp-2">{answer.text}</p>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/interview/setup" className="flex-1">
              <Button className="w-full">Try Again</Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button variant="outline" className="w-full bg-transparent">
                View Leaderboard
              </Button>
            </Link>
          </div>

          {/* Feedback Section */}
          <Card className="p-8 border border-border bg-secondary/50">
            <h3 className="text-lg font-bold mb-4">Want to download your results?</h3>
            <p className="text-muted-foreground mb-4">
              Get a detailed PDF report with your performance breakdown, transcript, and personalized recommendations.
            </p>
            <Button variant="outline" onClick={handleDownloadPDF}>Download PDF Report</Button>
          </Card>
        </div>
      </div>
      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8 text-center text-muted-foreground">
        <Link href="https://mokshbhardwaj.netlify.app/">Powered By Moksh Bhardwaj</Link>
      </footer>
    </main>
  )
}
