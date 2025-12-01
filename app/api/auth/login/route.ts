import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { createToken } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 })
    }

    const db = await getDatabase()
    const user = await db.collection("users").findOne({ email })

    if (!user) {
      return NextResponse.json({ error: "Invalid email" }, { status: 401 })
    }

    const isPasswordValid = verifyPassword(password, user.passwordHash)

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
    }

    const token = createToken({
      userId: user._id.toString(),
      email: user.email,
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
