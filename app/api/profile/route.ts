import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = await getDatabase()
    const profile = await db.collection('profiles').findOne({ userId: user.userId })
    return NextResponse.json({ profile: profile || null })
  } catch (err) {
    console.error('Profile GET error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    // basic validation
    const payload = {
      userId: user.userId,
      email: user.email,
      data: body || {},
      updatedAt: new Date(),
    }

    const db = await getDatabase()
    await db.collection('profiles').updateOne(
      { userId: user.userId },
      { $set: payload },
      { upsert: true }
    )

    return NextResponse.json({ ok: true, profile: payload })
  } catch (err) {
    console.error('Profile POST error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
