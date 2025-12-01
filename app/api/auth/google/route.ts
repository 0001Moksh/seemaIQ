import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google client ID not configured' }, { status: 500 });
    }

    // Verify ID token using google-auth-library which validates signature and audience
    let payload: any;
    try {
      const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err);
      return NextResponse.json({ error: 'Invalid or expired Google token' }, { status: 401 });
    }

    const { email, name, picture, sub } = payload || {};

    if (!email) {
      return NextResponse.json({ error: 'Email not provided by Google' }, { status: 400 });
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Find or create user
    let user = await db.collection('users').findOne({ email });

    if (!user) {
      const result = await db.collection('users').insertOne({
        email,
        name,
        avatar: picture,
        password: null,
        googleId: sub,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      user = await db.collection('users').findOne({ _id: result.insertedId });
    } else if (!user.googleId) {
      await db.collection('users').updateOne({ _id: user._id }, { $set: { googleId: sub, avatar: picture, updatedAt: new Date() } });
      user = await db.collection('users').findOne({ _id: user._id });
    }

    if (!user) {
      return NextResponse.json({ error: 'User creation failed' }, { status: 500 });
    }

    const authToken = createToken({ userId: user._id.toString(), email: user.email });

    return NextResponse.json({
      message: 'Google authentication successful',
      token: authToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error in Google auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
