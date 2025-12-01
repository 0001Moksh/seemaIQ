"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Upload, Download, LogOut, Plus, X, User, Mail, Phone, Briefcase, Code, Link as LinkIcon, FileText, Check, Sparkles } from "lucide-react"
import type { ResumeData } from "@/lib/resume-parser"; import { ArrowUp, ArrowLeft } from "lucide-react"
import { Undo2 } from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

function calculateCompletion(profile: Partial<ResumeData> & { name?: string; email?: string }) {
    const fields = [
        profile.name,
        profile.email,
        profile.phone,
        profile.summary,
        profile.skills && profile.skills.length > 0,
        profile.experience && profile.experience.length > 0,
    ]
    return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

type ProfileData = ResumeData & {
    name?: string
    email?: string
    resumeFileName?: string
    domain?: string
}

export default function ProfilePage() {
    const router = useRouter()
    const { user, isLoading, isLoggedIn, logout } = useAuth()
    const [profile, setProfile] = useState<Partial<ProfileData>>({})
    const [initialProfile, setInitialProfile] = useState<Partial<ProfileData>>({})
    const [parsing, setParsing] = useState(false)
    const [showScroll, setShowScroll] = useState(false)

    // Track changes
    const hasChanges = JSON.stringify(profile) !== JSON.stringify(initialProfile)
    const completion = calculateCompletion(profile)
    const canDownload = completion >= 80

    useEffect(() => {
        if (!isLoading && !isLoggedIn) router.push("/auth/login")

        if (user) {
            setProfile(p => ({ ...p, name: user.name || p.name, email: user.email || p.email }))
            setInitialProfile(p => ({ ...p, name: user.name || p.name, email: user.email || p.email }))
        }

        const saved = localStorage.getItem("seemaiq_profile")
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setProfile(prev => ({ ...prev, ...parsed }))
                setInitialProfile(prev => ({ ...prev, ...parsed }))
            } catch (e) {
                console.error("Failed to load saved profile")
            }
        }
    }, [user, isLoading, isLoggedIn, router])

    useEffect(() => {
        const checkScrollTop = () => {
            if (!showScroll && window.pageYOffset > 400) {
                setShowScroll(true)
            } else if (showScroll && window.pageYOffset <= 400) {
                setShowScroll(false)
            }
        }
        window.addEventListener("scroll", checkScrollTop)
        return () => window.removeEventListener("scroll", checkScrollTop)
    }, [showScroll])

    const scrollTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }
    const updateField = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
        setProfile(prev => ({ ...prev, [key]: value }))
    }

    const saveProfile = () => {
        try {
            localStorage.setItem("seemaiq_profile", JSON.stringify(profile))
            setInitialProfile({ ...profile }) // Mark as saved
            toast({
                title: "Saved!",
                description: "Your profile has been saved locally.",
                duration: 3000,
            })
        } catch (err) {
            toast({
                title: "Save failed",
                description: "Could not save profile. Try again.",
                variant: "destructive",
            })
        }
    }

    const undoChanges = () => {
        setProfile(initialProfile)
        toast({
            title: "Changes Reverted",
            description: "Your unsaved changes have been discarded.",
        })
    }

    const handleFile = async (file?: File) => {
        if (!file) return
        setParsing(true)
        try {
            const form = new FormData()
            form.append("file", file)
            const token = localStorage.getItem("authToken")
            const res = await fetch("/api/interview/parse-resume", {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: form,
            })
            if (!res.ok) throw new Error("Parse failed")
            const data: ResumeData = await res.json()
            const updated = { ...profile, ...data, resumeFileName: file.name }
            // If parser returns a domain, merge it
            if ((data as any).domain) updated.domain = (data as any).domain
            setProfile(updated)
            setInitialProfile(updated) // Auto-save after successful parse
            toast({
                title: "Resume Parsed!",
                description: `${file.name} loaded successfully.`,
            })
        } catch (err) {
            toast({
                title: "Parse Failed",
                description: "Please upload a valid PDF or DOCX file.",
                variant: "destructive",
            })
        } finally {
            setParsing(false)
        }
    }

    const addSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && e.currentTarget.value.trim()) {
            const skill = e.currentTarget.value.trim()
            if (!(profile.skills || []).includes(skill)) {
                updateField("skills", [...(profile.skills || []), skill])
            }
            e.currentTarget.value = ""
            e.preventDefault()
        }
    }

    const removeSkill = (skill: string) => updateField("skills", profile.skills?.filter(s => s !== skill) || [])

    const addExperience = () => updateField("experience", [
        { company: "", position: "", duration: "", responsibilities: [], achievements: [] },
        ...(profile.experience || [])
    ])

    const removeExperience = (i: number) => updateField("experience", profile.experience?.filter((_, idx) => idx !== i) || [])

    const updateExperience = (i: number, field: 'company' | 'position' | 'duration' | 'title', value: string) => {
        const updated = [...(profile.experience || [])]
        updated[i] = { ...updated[i], [field]: value }
        updateField("experience", updated)
    }

    const addProject = () => updateField("projects", [{ name: "", description: "", technologies: [] }, ...(profile.projects || [])])
    const removeProject = (i: number) => updateField("projects", profile.projects?.filter((_, idx) => idx !== i) || [])

    const updateProject = (i: number, field: "name" | "description", value: string) => {
        const updated = [...(profile.projects || [])]
        // @ts-ignore
        updated[i] = { ...updated[i], [field]: value.slice(0, field === "description" ? 400 : 100) }
        updateField("projects", updated)
    }

    const downloadResume = async () => {
        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 18;
            let y = 22;

            // Util: Add new page BEFORE starting a section
            const requireSpaceBefore = (need = 30) => {
                if (y + need > 280) {
                    doc.addPage();
                    y = 22;
                }
            };
            // ===== HEADER =====
            const drawSectionHeader = (title: string) => {
                requireSpaceBefore(20);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(17);
                doc.setTextColor(25, 30, 35);
                doc.text(title, margin, y);
                y += 6; // HR Line 
                doc.setDrawColor(210, 210, 210);
                doc.setLineWidth(0.5);
                doc.line(margin, y, pageWidth - margin, y); y += 8;
            };

            // ===== HEADER =====

            // NAME
            doc.setFont("helvetica", "bold");
            doc.setFontSize(30);
            doc.setTextColor(20, 25, 30);
            doc.text(profile.name || "Your Name", pageWidth / 2, y, { align: "center" });
            y += 7;

            // CONTACT (2 per row)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11.2);
            doc.setTextColor(80, 85, 95);

            const contactInfo = [
                profile.email,
                profile.phone,
                profile.linkedin,
                profile.github,
                profile.location
            ].filter(Boolean);

            let lines: string[] = [];
            for (let i = 0; i < contactInfo.length; i += 2) {
                const a = contactInfo[i];
                const b = contactInfo[i + 1];

                if (b) {
                    lines.push(`${a} || ${b}`);
                } else {
                    lines.push(`${a}`);
                }
            }

            // Render final rows
            lines.forEach(line => {
                doc.text(line, pageWidth / 2, y, { align: "center" });
                y += 6;
            });

            y += 6;

            // SUMMARY
            if (profile.summary) {
                drawSectionHeader("Objective");

                doc.setFont("helvetica", "normal");
                doc.setFontSize(11);
                doc.setTextColor(70, 75, 80);

                const sumLines = doc.splitTextToSize(profile.summary, pageWidth - margin * 2);
                doc.text(sumLines, margin, y);
                y += sumLines.length * 5 + 10;
            }

            // SKILLS (two-column)
            if (profile.skills?.length) {
                drawSectionHeader("Skills");

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10.5);
                doc.setTextColor(60, 65, 70);

                const gap = 10;
                const colWidth = (pageWidth - margin * 2 - gap) / 2;

                const left: string[] = [];
                const right: string[] = [];

                profile.skills.forEach((s, i) =>
                    (i % 2 === 0 ? left : right).push(`• ${s}`)
                );

                const leftLines = doc.splitTextToSize(left.join("\n"), colWidth);
                const rightLines = doc.splitTextToSize(right.join("\n"), colWidth);

                const rows = Math.max(leftLines.length, rightLines.length);

                for (let i = 0; i < rows; i++) {
                    requireSpaceBefore(10);

                    if (leftLines[i]) doc.text(leftLines[i], margin, y);
                    if (rightLines[i]) doc.text(rightLines[i], margin + colWidth + gap, y);
                    y += 5;
                }

                y += 10;
            }

            // EXPERIENCE
            if (profile.experience?.length) {
                drawSectionHeader("Work Experience");

                for (const exp of profile.experience) {
                    requireSpaceBefore(30);

                    const position = exp.position || "Position";
                    const company = exp.company || "Company";
                    const duration = exp.duration || "";

                    // Line: Position at Company (Duration)
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(11.5);
                    doc.setTextColor(20, 25, 30);

                    // Semi-bold effect
                    doc.setTextColor(20, 25, 30);
                    (doc as any).setGState(new (doc as any).GState({ lineWidth: 0.2 }));

                    doc.text(`${position} at ${company} ${duration ? `(${duration})` : ""}`, margin, y);

                    y += 7;

                    // Description
                    if (exp.responsibilities?.length || exp.achievements?.length) {
                        const descArray = exp.responsibilities?.length
                            ? exp.responsibilities
                            : exp.achievements;

                        const lineText = descArray.map(d => `• ${d}`).join("\n");
                        const lines = doc.splitTextToSize(lineText, pageWidth - margin * 2);

                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(5.5);
                        doc.setTextColor(70, 75, 80);
                        doc.text(lines, margin, y);
                        y += lines.length * 5 + 8;
                    } else {
                        y += 3;
                    }
                }

                y += 10;
            }


            // PROJECTS
            if (profile.projects?.length) {
                drawSectionHeader("Projects");

                for (const proj of profile.projects) {
                    requireSpaceBefore(25);

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(11.5);
                    doc.text(proj.name || "Project", margin, y);
                    y += 6;

                    if (proj.description) {
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(10.5);
                        const lines = doc.splitTextToSize(proj.description, pageWidth - margin * 2);
                        doc.text(lines, margin + 5, y);
                        y += lines.length * 5 + 10;
                    }
                }
            }

            // FOOTER
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(130, 135, 140);
            doc.text("Generated via SeemaIQ – AI Interview Simulator", margin, 286);

            // SAVE FILE
            const fileName = `${(profile.name || "My_Resume").replace(/[^a-zA-Z0-9]/g, "_")}-${profile.domain || ""}.pdf`;
            doc.save(fileName);
            toast({ title: "Resume Downloaded!", description: `${fileName} is ready!` });

        } catch (error) {
            console.error("PDF generation failed:", error);
            toast({
                title: "Download Failed",
                description: "Downloading backup JSON file...",
                variant: "destructive",
            });

            const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(profile.name || "resume")}_backup.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };


    return (
        <>
            <main className="min-h-screen liquid-bg">
                <header className="border-b border-border top-0 z-50 bg-secondary/50 backdrop-blur">
                    <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
                        <Link href="/">
                            <img src="/logo.png" alt="SeemaIQ Logo" className="w-35 h-20 rounded-lg object-cover" />
                        </Link>
                        <Button className="hover:text-red-600 hover:bg-black scale-105 transition-all" variant="ghost" size="sm" onClick={() => { logout(); router.push("/") }}>
                            <LogOut className="w-4 h-4 mr-2" /> Logout
                        </Button>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-4">
                    {/* Back Button */}
                    <div className="py-6">
                        <Link href="/dashboard">
                            <Button variant="outline">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Dashboard
                            </Button>
                        </Link>
                    </div>
                    {/* Header */}
                    <div className="items-center justify-center">
                        <CardHeader className="text-center py-10">
                            {/* <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mb-6">
                                {profile.name?.[0] || <User className="w-10 h-10" />}
                            </div> */}
                            <CardTitle className="text-3xl">Welcome back, {profile.name?.split(" ")[0] || "there"}!</CardTitle>
                            <CardDescription className="text-lg mt-3 max-w-2xl mx-auto">
                                Upload your resume to auto-fill, or edit manually below. Your progress is saved automatically.
                            </CardDescription>
                        </CardHeader>
                    </div>

                    {/* Hero Upload Card */}
                    <Card className="mb-10 overflow-hidden border shadow-xl">
                        <CardContent className="grid md:grid-cols-2 gap-8 items-center p-2">
                            <div className="text-center">
                                <Label htmlFor="resume-upload" className="cursor-pointer block">
                                    <div className="mx-auto w-64 p-10 border-4 border-dashed border-blue-400/30 rounded-2xl hover:border-blue-400/60 transition-all group">
                                        <Upload className="w-16 h-16 mx-auto text-blue-500 group-hover:scale-110 transition" />
                                        <p className="mt-4 font-medium">Drop your resume here</p>
                                        <p className="text-sm text-muted-foreground">PDF or DOCX • Max 10MB</p>
                                    </div>
                                    <input
                                        id="resume-upload"
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        className="hidden"
                                        onChange={(e) => handleFile(e.target.files?.[0])}
                                        disabled={parsing}
                                    />
                                </Label>
                                {parsing && <p className="mt-4 text-blue-600 font-medium">Parsing your resume...</p>}
                            </div>

                            <div className="space-y-6 space-x-10 p-3">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Profile Completion</p>
                                    <Progress value={completion} className="h-3" />
                                    <p className="mt-2 text-2xl font-bold">{completion}% Complete</p>
                                    {canDownload ? (
                                        <p className="text-green-600 flex items-center gap-2 mt-3">
                                            <Check className="w-5 h-5" /> Ready to download!
                                        </p>
                                    ) : (
                                        <p className="text-amber-600">Add more info to unlock download</p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <Button size="lg" onClick={() => document.getElementById("resume-upload")?.click()} disabled={parsing}>
                                        <Upload className="w-5 h-5 mr-2" />
                                        {parsing ? "Parsing..." : "Upload Resume"}
                                    </Button>
                                    <Button
                                        size="lg"
                                        onClick={downloadResume}
                                        disabled={!canDownload}
                                        className={canDownload ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" : ""}
                                    >
                                        <Download className="w-5 h-5 mr-2" />
                                        Download PDF
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Left: Personal + Summary */}
                        <div className="space-y-6">
                            <Card className="border shadow-lg">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-2xl">
                                        <User className="w-6 h-6 text-blue-600" /> Personal Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div><Label>Full Name</Label><Input value={profile.name || ""} onChange={e => updateField("name", e.target.value)} placeholder="John Doe" /></div>
                                    <div><Label>Email</Label><Input type="email" value={profile.email || ""} onChange={e => updateField("email", e.target.value)} /></div>
                                    <div><Label>Phone</Label><Input value={profile.phone || ""} onChange={e => updateField("phone", e.target.value)} placeholder="+91 98765 43210" /></div>
                                    <div><Label>Domain</Label><Input value={profile.domain || ""} onChange={e => updateField("domain", e.target.value)} placeholder="e.g. Frontend, Data Science" /></div>
                                    <div><Label>Address</Label><Input value={profile.location || ""} onChange={e => updateField("location", e.target.value)} placeholder="e.g. 123 Main St, City, Country" /></div>
                                    <div><Label>Links (LinkedIn)</Label><Input value={profile.linkedin || ""} onChange={e => updateField("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." /></div>
                                    <div><Label>Links (GitHub)</Label><Input value={profile.github || ""} onChange={e => updateField("github", e.target.value)} placeholder="https://github.com/..." /></div>
                                </CardContent>
                            </Card>

                            <Card className="border shadow-lg">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-2xl">
                                        About</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        placeholder="Passionate full-stack developer with 5+ years building scalable web apps..."
                                        value={profile.summary || ""}
                                        onChange={e => updateField("summary", e.target.value.slice(0, 500))}
                                        rows={6}
                                        className="resize-none"
                                    />
                                    <p className="text-right text-xs text-muted-foreground mt-2">
                                        {(profile.summary || "").length}/500
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: Skills, Experience, Projects */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Skills */}
                            <Card className="border shadow-lg">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span className="flex text-2xl items-center gap-3">
                                            Skills
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Input placeholder="Type skill & press Enter" onKeyDown={addSkill} />
                                    <div className="flex flex-wrap gap-1 mt-5">
                                        {(profile.skills || []).map((skill, i) => (
                                            <Badge key={i} variant="secondary" className="px-3 py-1.5 rounded-full bg-primary/1 border border-primary/30 text-sm flex items-center gap-2"
                                            >
                                                {skill}
                                                <button onClick={() => removeSkill(skill)} className="ml-3 rounded-full p-1 border hover:text-red-600">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Experience */}
                            <div className="">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold pt-5 flex items-center gap-3">
                                        Work Experience
                                    </h2>
                                    <Button onClick={addExperience} size="sm">
                                        <Plus className="w-4 h-4 mr-2" /> Add
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
                                    {(profile.experience || []).map((exp, i) => (
                                        <Card key={i} className="p-6 border shadow-md relative hover:shadow-lg transition">
                                            <Button size="icon" variant="ghost" className="absolute top-4 right-4" onClick={() => removeExperience(i)}>
                                                <X className="w-4 h-4" />
                                            </Button>
                                            <div className="space-y-3">
                                                <Input placeholder="Job Title" value={exp.position || ""} onChange={e => updateExperience(i, "position", e.target.value)} />
                                                <Input placeholder="Company" value={exp.company || ""} onChange={e => updateExperience(i, "company", e.target.value)} />
                                                <Input placeholder="2022 – Present" value={exp.duration || ""} onChange={e => updateExperience(i, "duration", e.target.value)} />
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            {/* Projects */}
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold pt-5 flex items-center gap-3">
                                        Projects
                                    </h2>
                                    <Button onClick={addProject} size="sm">
                                        <Plus className="w-4 h-4 mr-2" /> Add Project
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {(profile.projects || []).map((proj, i) => (
                                        <Card key={i} className="p-6 border shadow-md relative hover:shadow-lg transition">
                                            <Button size="icon" variant="ghost" className="absolute top-4 right-4" onClick={() => removeProject(i)}>
                                                <X className="w-4 h-4" />
                                            </Button>
                                            <Input className="text-lg font-semibold mb-3" placeholder="Project Name" value={proj.name || ""} onChange={e => updateProject(i, "name", e.target.value)} />
                                            <Textarea
                                                placeholder="Built a full-stack e-commerce platform using Next.js, Node.js & MongoDB..."
                                                value={proj.description || ""}
                                                onChange={e => updateProject(i, "description", e.target.value)}
                                                rows={3}
                                            />
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            {/* Final Save Button */}
                            <div className="flex justify-end gap-4 pt-8">
                                {hasChanges && (
                                    <Button size="lg" variant="ghost" onClick={undoChanges}>
                                        <Undo2 className="w-5 h-5 mr-2" />
                                        Undo
                                    </Button>
                                )}
                                <Button
                                    size="lg"
                                    onClick={saveProfile}
                                    disabled={!hasChanges}
                                    className={hasChanges ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg" : "opacity-60"}
                                >
                                    {hasChanges ? (
                                        <>
                                            <Sparkles className="w-5 h-5 mr-2" />
                                            Save Changes
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-5 h-5 mr-2" />
                                            All Saved
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Footer */}
                <footer className="border-t border-border mt-10 py-8 text-center text-muted-foreground">
                    <Link href="https://mokshbhardwaj.netlify.app/">Powered By Moksh Bhardwaj</Link>
                </footer>
                {showScroll && (
                    <Button
                        onClick={scrollTop}
                        size="icon"
                        className="fixed bottom-8 right-8 h-12 w-12 rounded-full 
                   bg-primary/90 backdrop-blur-xl border border-white/20
                   shadow-[0_0_25px_rgba(0,0,0,0.25)]
                   hover:bg-primary transition-all duration-300 
                   animate-in fade-in zoom-in"
                    >
                        <ArrowUp className="h-6 w-6" />
                    </Button>
                )}
            </main>
            <Toaster />
        </>
    )
}