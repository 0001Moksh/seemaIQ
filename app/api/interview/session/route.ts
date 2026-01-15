import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

// Health check (ping=true) and session fetch
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Lightweight ping for network quality checks
  if (searchParams.get("ping") === "true") {
    return new NextResponse(null, { status: 200 })
  }

  const sessionId = searchParams.get("sessionId")
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
  }

  try {
    const db = await getDatabase()
    const session = await db.collection("sessions").findOne({ _id: new ObjectId(sessionId) })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({ session }, { status: 200 })
  } catch (err) {
    console.error("Failed to fetch session", err)
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 })
  }
}

// HEAD handler for ping endpoints
export async function HEAD(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get("ping") === "true") {
    return new NextResponse(null, { status: 200 })
  }
  // For HEAD without ping, just return 200 to avoid noisy errors
  return new NextResponse(null, { status: 200 })
}
