import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { createToken } from "@/lib/auth"
import { hashPassword } from "@/lib/password"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = await getDatabase()
    const existingUser = await db.collection("users").findOne({ email })

    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    const hashedPassword = hashPassword(password)

    const result = await db.collection("users").insertOne({
      name,
      email,
      passwordHash: hashedPassword,
      createdAt: new Date(),
      stats: {
        totalInterviews: 0,
        averageScore: 0,
      },
    })

    const token = createToken({
      userId: result.insertedId.toString(),
      email,
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: result.insertedId,
        name,
        email,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
