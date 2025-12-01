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

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    // Initialize Google Sign-In if configured
    if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      initializeGoogleSignIn()

      const timer = setTimeout(() => {
        try {
          renderGoogleSignInButton('google-signin-button', handleGoogleSignInSuccess)
        } catch (err) {
          console.log('Google Sign-In button not ready yet')
        }
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [])

  const handleGoogleSignInSuccess = async (credentialResponse: any) => {
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
        setError(data.error || 'Google sign-in failed')
        return
      }

      // Save token and redirect
      localStorage.setItem('authToken', data.token)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      await login(email, password)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen liquid-bg text-foreground items-center justify-center px-4">
      <header className="border-border">
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
      <Card className="max-w-7xl mx-auto px-4 py-20 w-full max-w-md p-8 border border-border">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to continue practicing</p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/20 border border-destructive/30 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
            <div id="google-signin-button" className="flex justify-center"></div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">Google Sign-In is not configured.</div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </Card>
      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8 text-center text-muted-foreground">
        <Link href="https://mokshbhardwaj.netlify.app/">Powered By Moksh Bhardwaj</Link>
      </footer>
    </main>
  )
}
