"use client"

import { useEffect, useState } from "react"

interface User {
  id: string
  name: string
  email: string
  stats?: {
    totalInterviews: number
    averageScore: number
  }
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    // Check localStorage for existing token
    const storedToken = localStorage.getItem("authToken")
    if (storedToken) {
      setToken(storedToken)
      verifyToken(storedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        localStorage.removeItem("authToken")
        setToken(null)
      }
    } catch (error) {
      console.error("Token verification failed:", error)
      localStorage.removeItem("authToken")
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Login failed")
      }

      const data = await response.json()
      localStorage.setItem("authToken", data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (error) {
      throw error
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Signup failed")
      }

      const data = await response.json()
      localStorage.setItem("authToken", data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem("authToken")
    setToken(null)
    setUser(null)
  }

  return {
    user,
    isLoading,
    isLoggedIn: !!user,
    login,
    signup,
    logout,
  }
}
