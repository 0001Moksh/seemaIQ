"use client"

import type React from "react"
import { useEffect } from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { initializeGoogleSignIn, renderGoogleSignInButton } from "@/lib/google-auth"

type SignupStep = "name-email" | "verify-otp" | "password"

export default function SignupPage() {
  const router = useRouter()
  const { signup } = useAuth()
  const [step, setStep] = useState<SignupStep>("name-email")
  
  // Step 1: Name & Email
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  
  // Step 2: OTP Verification
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpTimer, setOtpTimer] = useState(0)
  
  // Step 3: Password
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    // Initialize Google Sign-In
    initializeGoogleSignIn()
    
    // Render Google button after a short delay
    const timer = setTimeout(() => {
      try {
        renderGoogleSignInButton('google-signup-button', handleGoogleSignUpSuccess)
      } catch (err) {
        console.log('Google Sign-In button not ready yet')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const handleGoogleSignUpSuccess = async (credentialResponse: any) => {
    setError("")
    setIsLoading(true)

    try {
      const token = credentialResponse.credential
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Google sign-up failed')
        return
      }

      // Save token and redirect
      localStorage.setItem('authToken', data.token)
      setSuccess('Account created successfully!')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 1: Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!name.trim()) {
      setError("Name is required")
      return
    }

    if (!email.trim()) {
      setError("Email is required")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Invalid email format")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to send OTP")
        return
      }

      setOtpSent(true)
      setSuccess("OTP sent to your email!")
      setStep("verify-otp")
      
      // Start 5-minute timer
      setOtpTimer(300)
      const timer = setInterval(() => {
        setOtpTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            setOtpSent(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!otp.trim()) {
      setError("OTP is required")
      return
    }

    if (otp.length !== 6) {
      setError("OTP must be 6 digits")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to verify OTP")
        return
      }

      setSuccess("Email verified successfully!")
      setStep("password")
      setOtp("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP")
    } finally {
      setIsLoading(false)
    }
  }

  // Step 3: Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!password || !confirmPassword) {
      setError("Both password fields are required")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)

    try {
      await signup(name, email, password)
      setSuccess("Account created successfully!")
      setTimeout(() => {
        router.push("/dashboard")
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setStep("name-email")
    setOtp("")
    setOtpSent(false)
    setOtpTimer(0)
    setError("")
    setSuccess("")
  }

  const handleBackToOTP = () => {
    setStep("verify-otp")
    setPassword("")
    setConfirmPassword("")
    setError("")
    setSuccess("")
  }

  return (
    <main className="min-h-screen liquid-bg text-foreground flex flex-col items-center justify-center px-4">
      <header className="border-border mb-8">
        <div className="flex items-center justify-center">
          <Link href="/">
            <img
              src="/logo.png"
              alt="SeemaIQ Logo"
              className="w-24 h-16 lg:w-32 lg:h-20 rounded-lg object-cover"
            />
          </Link>
        </div>
      </header>

      <Card className="w-full max-w-md p-8 border border-border">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="text-muted-foreground text-sm">
              {step === "name-email" && "Step 1/3: Enter your details"}
              {step === "verify-otp" && "Step 2/3: Verify your email"}
              {step === "password" && "Step 3/3: Create password"}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2">
            <div className={`h-1 flex-1 rounded-full transition-all ${step !== "name-email" ? "bg-primary" : "bg-muted"}`}></div>
            <div className={`h-1 flex-1 rounded-full transition-all ${step === "password" ? "bg-primary" : "bg-muted"}`}></div>
            <div className={`h-1 flex-1 rounded-full transition-all ${step === "password" ? "bg-primary" : "bg-muted"}`}></div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/20 border border-destructive/30 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-600 text-sm">
              {success}
            </div>
          )}

          {/* Step 1: Name & Email */}
          {step === "name-email" && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <Input
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending OTP..." : "Send OTP"}
              </Button>
            </form>
          )}

          {/* Step 2: Verify OTP */}
          {step === "verify-otp" && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-600">
                  We've sent a 6-digit OTP to <strong>{email}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Enter OTP</label>
                <Input
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {otpTimer > 0 ? `Expires in ${Math.floor(otpTimer / 60)}:${String(otpTimer % 60).padStart(2, "0")}` : "OTP expired"}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleBackToEmail}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify"}
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={handleSendOTP}
                disabled={isLoading || otpTimer > 0}
              >
                {otpTimer > 0 ? "Resend OTP (wait)" : "Resend OTP"}
              </Button>
            </form>
          )}

          {/* Step 3: Password */}
          {step === "password" && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
             <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleBackToOTP}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </Card>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8 text-center text-muted-foreground text-sm">
        <Link href="https://mokshbhardwaj.netlify.app/">Powered By Moksh Bhardwaj</Link>
      </footer>
    </main>
  )
}
