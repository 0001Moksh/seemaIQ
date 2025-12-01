"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"

interface InterviewAttempt {
  id: string
  role: string
  date: string
  score: number
  sessionId?: string
}

interface Stats {
  totalInterviews: number
  averageScore: number
  currentStreak: number
  recentInterviews: InterviewAttempt[]
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoading, isLoggedIn, logout } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  // Dynamic greeting function
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 18) return "Good Afternoon"
    return "Good Evening"
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/auth/login")
    }
  }, [isLoading, isLoggedIn, router])

  // Fetch stats on login
  useEffect(() => {
    if (isLoggedIn) {
      fetchStats()
    }
  }, [isLoggedIn])

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("authToken")
      const response = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  if (isLoading || !isLoggedIn) {
    return (
      <main className="min-h-screen liquid-bg text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen liquid-bg text-foreground">

      {/* Header */}
      <header className="border-b border-border top-0 z-50 bg-secondary/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-3">
          <Link href="/">
            <img
              src="/logo.png"
              alt="SeemaIQ Logo"
              className="w-28 h-12 sm:w-35 sm:h-20 pt-1 sm:pt-3 rounded-lg object-cover"
            />
          </Link>
          <div className="flex items-center gap-4">
            {/* User Icon */}
              <Link
              href="/dashboard/profile"
              className="text-muted-foreground hover:text-foreground transition"
            >
            <div className="relative">
              <div
                className="
        w-10 h-10 flex items-center justify-center
        rounded-full bg-black text-white font-semibold
        border-2 border-transparent
        animate-gradient
        bg-[length:200%_200%]
        ring-2 ring-transparent
      "
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, black, black), linear-gradient(90deg, #4f46e5, #9333ea)",
                  backgroundOrigin: "border-box",
                  backgroundClip: "padding-box, border-box",
                }}
              >
                {user?.name
                  ?.split(" ")
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </div>
            </div>
            </Link>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <div className="space-y-8">

          {/* Dynamic Greeting */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl font-bold">
              {getGreeting()},{" "}
              <span className="text-2xl sm:text-5xl font-extrabold text-blue-200 block sm:inline">
                {user?.name?.split(" ")[0]}
              </span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-lg">Ready to practice your interview skills?</p>
          </div>

          {/* Start Interview Section */}
          <Card className="p-6 sm:p-8 bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Start a New Interview</h2>
                <p className="text-muted-foreground">Choose your interview type and begin practicing</p>
              </div>
              <Link href="/interview/setup">
                <Button size="lg">Start Interview</Button>
              </Link>
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { label: "Total Interviews", value: stats?.totalInterviews || "0" },
              { label: "Average Score", value: (stats?.averageScore || 0) + "%" },
              { label: "Current Streak", value: (stats?.currentStreak || 0) + " days" },
            ].map((stat, i) => (
              <Card key={i} className="p-4 sm:p-6 border border-border">
                <p className="text-muted-foreground text-sm mb-2">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </Card>
            ))}
          </div>

          {/* Recent Attempts */}
          {stats?.recentInterviews && stats.recentInterviews.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Recent Attempts</h2>

              <div className="grid gap-4">
                {stats.recentInterviews.map((attempt) => (
                  <Link
                    key={attempt.id}
                    href={`/interview/results?sessionId=${attempt.sessionId || attempt.id}`}
                    className="block"
                  >
                    <Card
                      className="p-4 sm:p-5 border border-border hover:border-primary/40 hover:shadow-md transition-all cursor-pointer rounded-xl bg-card"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">

                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg font-semibold truncate">
                              {(() => {
                                switch (attempt.role.toLowerCase()) {
                                  case "hr":
                                    return "Mira Sharma - HR"
                                  case "expert":
                                    return "Ashish Yadev - Domain Expert"
                                  case "manager":
                                    return "Ryan Bhardwaj - MANAGER"
                                  default:
                                    return attempt.role
                                }
                              })()}
                            </p>
                            <div className="mt-2 sm:mt-0 flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                                {attempt.role.split("->").length} Round{attempt.role.split("->").length > 1 ? "s" : ""}
                              </span>
                              <p className="text-sm font-medium text-foreground/80">
                                {new Date(attempt.date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(attempt.date).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <p className="text-2xl sm:text-3xl font-bold text-accent">{attempt.score}%</p>
                        </div>

                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* No Attempts */}
          {!stats?.recentInterviews || stats.recentInterviews.length === 0 ? (
            <Card className="p-6 sm:p-8 border border-border text-center">
              <p className="text-muted-foreground mb-4">
                No interviews yet. Start your first practice session!
              </p>
              <Link href="/interview/setup">
                <Button>Start Your First Interview</Button>
              </Link>
            </Card>
          ) : null}

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8 text-center text-muted-foreground">
        <Link href="https://mokshbhardwaj.netlify.app/">Powered By Moksh Bhardwaj</Link>
      </footer>

    </main>
  )
}
