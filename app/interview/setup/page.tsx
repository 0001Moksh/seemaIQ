"use client"

import type React from "react"
import { Upload, FileText, X, CheckCircle, Code, Database, Briefcase, Palette, Cloud, Globe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface ResumeData {
  name: string
  email: string
  phone: string
  summary: string
  skills: string[]
  experience: Array<{ title: string; company: string; duration: string }>
  education: Array<{ degree: string; school: string; year: string }>
  projects: Array<{ name: string; description: string }>
  certifications: string[]
  linkedin?: string
  github?: string
  portfolio?: string
  location?: string
}

export default function InterviewSetupPage() {
  const router = useRouter()
  const { isLoggedIn, isLoading } = useAuth()
  const [experience, setExperience] = useState("mid")
  const [domain, setDomain] = useState<string>("")
  const domains = [
    {
      id: "software",
      label: "Software Engineering",
      icon: Code,
      desc: "Web apps, mobile apps, frontend, backend and full-stack development."
    },

    {
      id: "data",
      label: "Data Science & AI/ML",
      icon: Database,
      desc: "Python, machine learning, deep learning, data analysis and model building."
    },

    {
      id: "product",
      label: "Product Management",
      icon: Briefcase,
      desc: "Planning features, managing teams, understanding users and product growth."
    },

    {
      id: "design",
      label: "UI/UX Design",
      icon: Palette,
      desc: "Designing screens, user flows, prototyping and improving user experience."
    },

    {
      id: "devops",
      label: "DevOps / Cloud",
      icon: Cloud,
      desc: "Deploy apps, manage servers, CI/CD, Docker, AWS, cloud automation."
    },

    // {
    //   id: "other",
    //   label: "Other Domains",
    //   icon: Globe,
    //   desc: "Sales, marketing, HR, support and all general job roles."
    // },
  ];

  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [showResumeSummary, setShowResumeSummary] = useState(false)
  const [resumeSource, setResumeSource] = useState<'profile' | 'upload' | 'manual'>('profile')

  const [interviewWithoutResume, setInterviewWithoutResume] = useState(false)
  const [noResumeName, setNoResumeName] = useState("")
  const [noResumeEmail, setNoResumeEmail] = useState("")
  const [noResumePhone, setNoResumePhone] = useState("")
  const [noResumeSkills, setNoResumeSkills] = useState<string[]>([])
  const [noResumeSkillInput, setNoResumeSkillInput] = useState("")
  const [noResumeProjects, setNoResumeProjects] = useState<Array<{ name: string; description: string }>>([])
  const [noResumeExperience, setNoResumeExperience] = useState<Array<{ company: string; title: string; duration: string }>>([])

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/auth/login")
    }
  }, [isLoading, isLoggedIn, router])

  // When user selects "Use Profile", try to load saved profile and map to resumeData
  useEffect(() => {
    if (resumeSource !== 'profile') return
    try {
      const saved = localStorage.getItem('seemaiq_profile')
      if (!saved) return
      const parsed = JSON.parse(saved)
      const mapped: ResumeData = {
        name: parsed.name || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        summary: parsed.summary || '',
        skills: parsed.skills || [],
        experience: parsed.experience || [],
        education: parsed.education || [],
        projects: parsed.projects || [],
        certifications: parsed.certifications || [],
        linkedin: parsed.linkedin,
        github: parsed.github,
        portfolio: parsed.portfolio,
        location: parsed.location,
      }
      // if profile contains a domain, set the domain input as well
      if (parsed.domain && !domain) {
        setDomain(parsed.domain)
      }
      setResumeData(mapped)
      setShowResumeSummary(true)
      setInterviewWithoutResume(false)
    } catch (e) {
      // ignore
    }
  }, [resumeSource])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setResumeFile(e.target.files[0])
      setShowResumeSummary(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setResumeFile(e.dataTransfer.files[0])
      setShowResumeSummary(false)
      e.dataTransfer.clearData()
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleParseResume = async () => {
    if (!resumeFile) return

    setIsParsing(true)
    try {
      const token = localStorage.getItem("authToken")
      const formData = new FormData()
      formData.append("file", resumeFile)

      const parseResponse = await fetch("/api/interview/parse-resume", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (parseResponse.ok) {
        const data = await parseResponse.json()
        // ensure arrays exist to avoid render errors
        const normalized = {
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          summary: data.summary || "",
          skills: data.skills || [],
          experience: data.experience || [],
          education: data.education || [],
          projects: data.projects || [],
          certifications: data.certifications || [],
          linkedin: data.linkedin,
          github: data.github,
          portfolio: data.portfolio,
          location: data.location,
        }
        setResumeData(normalized)
        setShowResumeSummary(true)
      } else {
        console.error("Failed to parse resume")
      }
    } catch (error) {
      console.error("Failed to parse resume:", error)
    } finally {
      setIsParsing(false)
    }
  }

  const updateResumeData = (key: keyof ResumeData, value: any) => {
    setResumeData((prev) => {
      if (!prev) return prev
      return { ...prev, [key]: value }
    })
  }

  const addResumeProject = () => {
    if (!resumeData) return
    updateResumeData("projects", [{ name: "", description: "" }, ...resumeData.projects])
  }

  const addResumeExperience = () => {
    if (!resumeData) return
    updateResumeData("experience", [{ company: "", title: "", duration: "" }, ...resumeData.experience])
  }

  // Auto-parse resume when a file is selected/dropped
  useEffect(() => {
    if (resumeFile && !showResumeSummary && !isParsing) {
      handleParseResume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeFile])

  const handleStartInterview = async () => {
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem("authToken")

      // Fixed workflow: Round 1=HR, Round 2=Expert, Round 3=Manager
      const rounds = ["hr", "technical", "manager"]

      // Determine final resume data based on selected source
      let finalResumeData: ResumeData | null = null
      if (resumeSource === 'manual' || interviewWithoutResume) {
        finalResumeData = {
          name: noResumeName,
          email: noResumeEmail,
          phone: noResumePhone || "",
          summary: "",
          skills: noResumeSkills,
          experience: noResumeExperience,
          education: [],
          projects: noResumeProjects,
          certifications: [],
        }
      } else if (resumeSource === 'profile') {
        finalResumeData = resumeData
      } else if (resumeSource === 'upload') {
        finalResumeData = resumeData
      }

      if (!finalResumeData && !interviewWithoutResume) {
        // show a toast
        try {
          // prefer using window-level toast if available
          // otherwise console
          // eslint-disable-next-line no-undef
          // @ts-ignore
          toast && toast({ title: 'Provide resume', description: 'Please upload or select a resume before starting.' })
        } catch (e) {
          console.warn('Missing resumeData')
        }
        setIsSubmitting(false)
        return
      }

      const response = await fetch("/api/interview/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: rounds[0], // Always start with HR (Round 1)
          experience,
          domain,
          resumeData: finalResumeData,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/interview/room?sessionId=${data.sessionId}`)
      } else {
        const error = await response.json()
        console.error("Failed to create interview:", error)
      }
    } catch (error) {
      console.error("Failed to start interview:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || !isLoggedIn) {
    return null
  }

  const canStartInterview = (() => {
    if (isSubmitting) return false
    if (!experience) return false
    if (resumeSource === 'manual' || interviewWithoutResume) {
      const emailOk = noResumeEmail.trim() !== ""
      const nameOk = noResumeName.trim() !== ""
      const phoneOk = noResumePhone.trim() === "" || /^\d{10}$/.test(noResumePhone.trim())
      return nameOk && emailOk && phoneOk
    }

    if (resumeSource === 'profile' || resumeSource === 'upload') {
      if (!resumeData) return false
      const resumePhoneOk = resumeData.phone ? /^\d{10}$/.test(resumeData.phone.replace(/\D/g, "")) : true
      return resumePhoneOk
    }

    return false
  })()

  return (
    <main className="min-h-screen liquid-bg text-foreground">
      {/* Header */}
      <header className="border-b border-border top-0 z-50 bg-secondary/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-3">
          <Link href="/">
            <img src="/logo.png" alt="SeemaIQ Logo" className="w-28 h-12 sm:w-35 sm:h-20 pt-1 sm:pt-3 rounded-lg object-cover" />
          </Link>
        </div>
      </header>

      {/* Setup Form */}
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-6xl font-bold">Configure Your Interview</h1>
            <p className="text-muted-foreground">Round 1: HR → Round 2: Expert → Round 3: Manager</p>
          </div>

          <Card className="p-6 sm:p-8 border border-border space-y-8">
           {/* Interview Workflow (Read-only Info) */}
            <div className="space-y-4">
              <h2 className="text-2xl pt-6 font-semibold text-center">Interview Workflow</h2>  
              <hr />          
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { round: 1, title: "HR Round", desc: "Communication & Soft Skills" },
                  { round: 2, title: "Technical Round", desc: "Problem Solving & Knowledge" },
                  { round: 3, title: "Manager Round", desc: "Leadership & Experience" },
                ].map((r) => (
                  <div
                    key={r.round}
                    className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 text-center"
                  >
                    <p className="text-xs text-muted-foreground">Round {r.round}</p>
                    <p className="font-semibold text-lg">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div className="space-y-4">
              <h2 className="text-2xl pt-6 font-semibold text-center">Your Experience Level</h2>
              <hr />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: "junior", title: "Junior (0-2 years)" },
                  { id: "mid", title: "Mid-Level (2-5 years)" },
                  { id: "senior", title: "Senior (5+ years)" },
                ].map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => setExperience(exp.id)}
                    className={`p-4 rounded-lg border-2 transition-all font-medium ${experience === exp.id ? "border-primary bg-primary/10" : "border-border hover:border-accent"
                      }`}
                  >
                    {exp.title}
                  </button>
                ))}
              </div>
            </div>

            <section className="mb-12">
              <h2 className="text-3xl pt-6 font-semibold text-center mb-8">Interview Domain</h2>
                    <hr className="flex-grow p-1 border-primary/50" />
              <div className="space-y-4">
                <div>
                  <Input
                    placeholder="Type your domain (e.g. Frontend, Data Science)"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="mb-2"
                  />
                    <hr className="flex-grow border-primary/50" />
                    <p className="text-xs text-muted-foreground mt-2">Or select from popular domains below:</p> 
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {domains.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDomain(d.label)}
                      className={`p-4 rounded-xl border transition-all text-left flex items-start gap-4 ${domain === d.label
                          ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:shadow-md"
                        }`}
                    >
                      <div className={`p-2 rounded-md ${domain === d.label ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <d.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{d.label}</div>
                        <p className="text-xs text-muted-foreground mt-1">{d.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Resume Upload / Manual Form */}
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center">
                Resume Submission
              </h2>

              {/* Resume source selector: profile / upload / manual */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => { setResumeSource('profile'); setInterviewWithoutResume(false); }}
                  className={`px-3 py-2 rounded ${resumeSource === 'profile' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  Use Profile
                </button>

                <button
                  type="button"
                  onClick={() => { setResumeSource('upload'); setInterviewWithoutResume(false); setResumeFile(null); setShowResumeSummary(false); setResumeData(null); }}
                  className={`px-3 py-2 rounded ${resumeSource === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  Upload New Resume
                </button>

                <button
                  type="button"
                  onClick={() => { setResumeSource('manual'); setInterviewWithoutResume(true); setResumeFile(null); setShowResumeSummary(false); setResumeData(null); }}
                  className={`px-3 py-2 rounded ${resumeSource === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  Manual Entry
                </button>
              </div>          
              {/* Upload box only when resumeSource === 'upload' */}
              {resumeSource === 'upload' && (
                <div>
                <div
                  className={`border-2 border-dashed rounded-xl p-10 transition-all cursor-pointer bg-secondary/30
      ${resumeFile ? "border-primary/60" : "border-border hover:border-primary/40"}`}
                  onClick={() => document.getElementById("resume-upload")?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="resume-upload"
                  />
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <svg
                        className="w-7 h-7 text-primary animate-pulse"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 4v16m8-8H4" />
                      </svg>
                    </div>

                    <p className="text-sm md:text-lg font-semibold">{resumeFile ? resumeFile.name : "Choose file or drag it here"}</p>
                    <p className="text-xs text-muted-foreground">PDF, DOC or DOCX</p>
                  </div>
                </div>
                </div>
              )}

              {/* Manual form when user selects manual source */}
              {resumeSource === 'manual' && (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Name <span className="text-destructive">*</span></label>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      {/* <span>Max 50 characters</span> */}
                      {/* <span>{noResumeName.length}/50</span> */}
                    </div>
                    <Input
                      placeholder="eg: Akshat Rai"
                      value={noResumeName || "Moksh"}
                      onChange={(e) => setNoResumeName(e.target.value.slice(0, 50))}
                      maxLength={50}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Email <span className="text-destructive">*</span></label>
                    <Input
                      placeholder="eg: abc@mail.com"
                      type="email"
                      value={noResumeEmail || "mokshbhardwaj2333@mail.com"}
                      onChange={(e) => setNoResumeEmail(e.target.value.slice(0, 100))}
                      maxLength={100}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Phone Number</label>
                    <Input
                      value={noResumePhone || ""}
                      onChange={(e) => setNoResumePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      placeholder="eg: 9876543210"
                      className="mt-2"
                    />
                    {/* <p className="text-xs text-muted-foreground mt-1">Digits only | {noResumePhone.length}/10</p> */}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Skills</label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="Add a skill and press Enter"
                        value={noResumeSkillInput || ""}
                        onChange={(e) => setNoResumeSkillInput(e.target.value.slice(0, 50))}
                        maxLength={50}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && noResumeSkillInput.trim() && noResumeSkills.length < 20) {
                            setNoResumeSkills((s) => [...s, noResumeSkillInput.trim()])
                            setNoResumeSkillInput("")
                          }
                        }}
                      />
                    </div>
                    {/* <p className="text-xs text-muted-foreground mt-1">Max 50 chars per skill | {noResumeSkills.length}/20 skills</p> */}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {noResumeSkills.map((s, i) => (
                        <div key={i} className="px-3 py-1 rounded-full bg-primary/10 border flex items-center gap-2">
                          {s}
                          <button onClick={() => setNoResumeSkills((prev) => prev.filter((_, idx) => idx !== i))} className="text-destructive">×</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Projects</label>
                      <Button className="text-muted-foreground" variant="ghost" onClick={() => setNoResumeProjects((p) => [...p, { name: "", description: "" }])}>Add Project</Button>
                    </div>
                    <div className="space-y-3 mt-3">
                      {noResumeProjects.map((proj, i) => (
                        <Card key={i} className="p-3 border border-border rounded-xl relative">
                          <button
                            onClick={() => setNoResumeProjects((p) => p.filter((_, idx) => idx !== i))}
                            className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 p-1 rounded"
                          >
                            ×
                          </button>
                          <Input
                            placeholder="Project Name (max 100)"
                            value={proj.name || ""}
                            onChange={(e) => {
                              const updated = [...noResumeProjects]
                              updated[i].name = e.target.value.slice(0, 100)
                              setNoResumeProjects(updated)
                            }}
                            maxLength={100}
                          />
                          <p className="text-xs text-muted-foreground mt-1">{proj.name.length}/100</p>
                          <textarea
                            placeholder="Project Description (max 500 chars)"
                            value={proj.description || ""}
                            onChange={(e) => {
                              const updated = [...noResumeProjects]
                              updated[i].description = e.target.value.slice(0, 500)
                              setNoResumeProjects(updated)
                            }}
                            maxLength={500}
                            className="w-full mt-2 p-2 rounded border text-sm"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground mt-1">{proj.description.length}/500</p>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Experience</label>
                      <Button className="text-muted-foreground" variant="ghost" onClick={() => setNoResumeExperience((e) => [...e, { company: "", title: "", duration: "" }])}>Add Experience</Button>
                    </div>
                    <div className="space-y-3 mt-3">
                      {noResumeExperience.map((exp, i) => (
                        <Card key={i} className="p-3 border border-border rounded-xl relative space-y-2">
                          <button
                            onClick={() => setNoResumeExperience((e) => e.filter((_, idx) => idx !== i))}
                            className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 p-1 rounded"
                          >
                            ×
                          </button>
                          <div>
                            <Input
                              placeholder="Company (max 100 chars)"
                              value={exp.company || ""}
                              onChange={(e) => {
                                const updated = [...noResumeExperience]
                                updated[i].company = e.target.value.slice(0, 100)
                                setNoResumeExperience(updated)
                              }}
                              maxLength={100}
                            />
                            <p className="text-xs text-muted-foreground mt-1">{exp.company.length}/100</p>
                          </div>
                          <div>
                            <Input
                              placeholder="Job Title (max 100 chars)"
                              value={exp.title || ""}
                              onChange={(e) => {
                                const updated = [...noResumeExperience]
                                updated[i].title = e.target.value.slice(0, 100)
                                setNoResumeExperience(updated)
                              }}
                              maxLength={100}
                            />
                            <p className="text-xs text-muted-foreground mt-1">{exp.title.length}/100</p>
                          </div>
                          <div>
                            <Input
                              placeholder="Duration eg: 2020-2023 (max 50 chars)"
                              value={exp.duration || ""}
                              onChange={(e) => {
                                const updated = [...noResumeExperience]
                                updated[i].duration = e.target.value.slice(0, 50)
                                setNoResumeExperience(updated)
                              }}
                              maxLength={50}
                            />
                            <p className="text-xs text-muted-foreground mt-1">{exp.duration.length}/50</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 🔥 Loading Animation During Resume Parsing */}
              {isParsing && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-primary/30 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>

                  {/* Smooth Progress Text Animation */}
                  <div className="flex flex-col items-center gap-1 mt-2">
                    <span className="text-xs text-muted-foreground animate-pulse">Analyzing...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Resume Data Display & Edit */}
            {showResumeSummary && resumeData && (
              <div className="space-y-10 border-t pt-10 animate-fadeIn">
                <h2 className="text-4xl font-semibold">Resume Information</h2>

                {/* Personal Info */}
                <div className="border p-6 rounded-lg">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-medium text-foreground">Name</label>
                    <Input value={resumeData.name || ""} disabled className="mt-2 bg-muted" />
                  </div>

                  <div>
                    <label className="font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      value={resumeData.email || ""}
                      onChange={(e) => updateResumeData("email", e.target.value.slice(0, 100))}
                      maxLength={100}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{resumeData.email.length}/100</p>
                  </div>

                  <div>
                    <label className="font-medium text-foreground">Phone Number</label>
                    <Input
                      value={resumeData.phone || ""}
                      onChange={(e) => updateResumeData("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      placeholder="eg: 987654XXX"
                      className="mt-2"
                    />
                  </div>
                </div>
                </div>


                {/* Summary */}
                <div>
                  <label className="text-xl font-medium text-foreground">Professional Summary</label>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Max 500 characters</span>
                    <span>{resumeData.summary.length}/500</span>
                  </div>
                  <textarea
                    value={resumeData.summary || ""}
                    onChange={(e) => updateResumeData("summary", e.target.value.slice(0, 500))}
                    maxLength={500}
                    className="w-full mt-2 p-4 rounded-xl border bg-secondary focus:ring-2 focus:ring-primary/40 transition"
                    rows={4}
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="text-xl font-medium text-foreground">Skills</label>

                  <Input
                    placeholder="Add skill and press Enter"
                    maxLength={50}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const input = e.currentTarget
                        if (input.value.trim() && resumeData.skills.length < 100) {
                          updateResumeData("skills", [...resumeData.skills, input.value.trim()])
                          input.value = ""
                        }
                      }
                    }}
                    className="mt-3 border-border"
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    {resumeData.skills.map((skill, i) => (
                      <div
                        key={i}
                        className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm flex items-center gap-2"
                      >
                        {skill}

                        {/* Modern round remove button */}
                        <button
                          onClick={() =>
                            updateResumeData(
                              "skills",
                              resumeData.skills.filter((_, idx) => idx !== i),
                            )
                          }
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-destructive/10 hover:bg-destructive/40 transition"
                        >
                          <span className="text-xs">×</span>
                        </button>
                      </div>
                    ))}
                  </div>

                </div>

                {/* Experience */}
                <div>
                  <div className="flex items-center justify-between pt-4 mb-4">
                    <label className="text-xl font-medium text-foreground block">Experience</label>
                    <Button className="border px-4" variant="ghost" onClick={addResumeExperience}>Add Experience</Button>
                  </div>
                  <div className="space-y-4">
                    {resumeData.experience.map((exp, i) => (
                      <Card key={i} className="p-5 border border-border rounded-xl shadow-sm space-y-3 relative">

                        <button
                          onClick={() =>
                            updateResumeData(
                              "experience",
                              resumeData.experience.filter((_, idx) => idx !== i),
                            )
                          }
                          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-destructive/20 hover:bg-destructive/40 transition"
                        >
                          <span className="text-lg font-bold text-destructive">×</span>
                        </button>

                        <div className="grid md:grid-cols-3 gap-4">
                          <Input
                            className="w-50"
                            placeholder="Company Name..."
                            value={exp.company || ""}
                            onChange={(e) => {
                              const updated = [...resumeData.experience]
                              updated[i].company = e.target.value.slice(0, 100)
                              updateResumeData("experience", updated)
                            }}
                            maxLength={100}
                          />
                          <Input
                            className="border-border"
                            placeholder="Job Title..."
                            value={exp.title || "Employee"}
                            onChange={(e) => {
                              const updated = [...resumeData.experience]
                              updated[i].title = e.target.value.slice(0, 100)
                              updateResumeData("experience", updated)
                            }}
                            maxLength={100}
                          />

                          <Input
                            className="w-70"
                            placeholder="Duration..."
                            value={exp.duration || ""}
                            onChange={(e) => {
                              const updated = [...resumeData.experience]
                              updated[i].duration = e.target.value.slice(0, 50)
                              updateResumeData("experience", updated)
                            }}
                            maxLength={50}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
                {/* Projects */}
                <div>
                  <div className="flex items-center justify-between pt-4 mb-4">
                    <label className="text-xl font-semibold text-foreground">
                      Projects
                    </label>

                    <Button variant="ghost" onClick={addResumeProject} className="border px-4">
                      Add Project
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {resumeData.projects.map((proj, i) => (
                      <Card key={i} className="p-3 border border-border rounded-xl shadow-sm relative">

                        {/* Round delete icon */}
                        <button
                          onClick={() =>
                            updateResumeData(
                              "projects",
                              resumeData.projects.filter((_, idx) => idx !== i),
                            )
                          }
                          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-destructive/20 hover:bg-destructive/40 transition"
                        >
                          <span className="text-lg font-bold text-destructive">×</span>
                        </button>
                        <Input
                          className="w-72 !text-lg mt-4"
                          placeholder="Project Name (max 20)"
                          value={proj.name || ""}
                          onChange={(e) => {
                            const updated = [...resumeData.projects]
                            updated[i].name = e.target.value.slice(0, 20)
                            updateResumeData("projects", updated)
                          }}
                          maxLength={20}
                        />
                        <p className="text-xs text-right text-muted-foreground">{proj.description.length}/200</p>

                        <textarea
                          placeholder="Project Description (max 200 chars)"
                          value={proj.description || ""}
                          onChange={(e) => {
                            const updated = [...resumeData.projects]
                            updated[i].description = e.target.value.slice(0, 200)
                            updateResumeData("projects", updated)
                          }}
                          maxLength={200}
                          className="w-full p-3 rounded-lg border bg-secondary text-sm"
                          rows={3}
                        />
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Start Button */}
            <div className="flex gap-4 pt-4">
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              {/* <Button onClick={handleStartInterview} disabled={!canStartInterview} className="flex-1"> */}
              <Button onClick={handleStartInterview} disabled={!canStartInterview} className="flex-1">
                {isSubmitting ? "Starting..." : "Start Interview"}
              </Button>
            </div>
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
