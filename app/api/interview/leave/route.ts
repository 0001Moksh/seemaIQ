import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ success: true, ignored: true }, { status: 200 })
}
