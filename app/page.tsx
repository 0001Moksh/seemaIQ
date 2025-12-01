import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-screen liquid-bg text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-3">
            <Link href="/">
            <img
              src="/logo.png"
              alt="SeemaIQ Logo"
              className="w-28 h-12 sm:w-35 sm:h-20 pt-1 sm:pt-3 rounded-lg object-cover"
            />
            </Link>
          <div className="flex items-center gap-3">
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
      <section className="max-w-7xl mx-auto px-4 py-12 sm:py-20 text-center">
        <div className="space-y-6 mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-5xl md:text-6xl font-bold text-balance">Master Your Interview Skills with AI</h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Get realistic practice interviews with AI interviewers that evaluate your communication, technical
            knowledge, and confidence in real-time.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 pt-4">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="text-base w-full sm:w-auto">
                Start Practicing
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="p-4 sm:p-5 bg-card border border-border rounded-lg hover:bg-card hover:border-foreground transition-colors w-full sm:w-auto">
              Learn More
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 md:mt-20">
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
