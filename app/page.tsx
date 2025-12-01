import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
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
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button className="bg-card border border-border rounded-lg hover:bg-card hover:border-foreground transition-colors">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="space-y-6 mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-balance">Master Your Interview Skills with AI</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Get realistic practice interviews with AI interviewers that evaluate your communication, technical
            knowledge, and confidence in real-time.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Link href="/dashboard">
              <Button size="lg" className="text-base">
                Start Practicing
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="p-5 bg-card border border-border rounded-lg hover:bg-card hover:border-foreground transition-colors">
              Learn More
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-20">
          {[
            { title: "3-Round Interview", desc: "HR → Domain Expert → Manager" },
            {
              title: "AI-Powered Evaluation",
              desc: "Real-time feedback on communication, technical skills & confidence",
            },
            { title: "Instant Results", desc: "Comprehensive scoring, transcript & improvement areas" },
          ].map((feature, i) => (
            <div key={i} className="p-6 bg-card border border-border rounded-lg hover:border-accent transition-colors">
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8 text-center text-muted-foreground">
        <Link href="https://mokshbhardwaj.netlify.app/">Powered By Moksh Bhardwaj</Link>
      </footer>
    </main>
  )
}
