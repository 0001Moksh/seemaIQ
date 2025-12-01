import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Basic env check
    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google client ID not configured' }, { status: 500 });
    }

    // Verify Google ID token using tokeninfo endpoint
    const response = await fetch('https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=' + token);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return NextResponse.json({ error: 'Invalid Google token', details: body }, { status: 401 });
    }

    const googleUser = await response.json();
    const { email, name, picture, aud, sub } = googleUser;

    // Ensure the token audience matches our client id
    if (aud && aud !== GOOGLE_CLIENT_ID && aud !== process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google token audience mismatch' }, { status: 401 });
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email not provided by Google' },
        { status: 400 }
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Find or create user
    let user = await db.collection('users').findOne({ email });

    if (!user) {
      // Create new user with Google signup
      const result = await db.collection('users').insertOne({
        email,
        name,
        avatar: picture,
        password: null, // OAuth users don't have passwords
        googleId: sub,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      user = await db.collection('users').findOne({ _id: result.insertedId });
    } else if (!user.googleId) {
      // Update existing user with Google ID
      await db.collection('users').updateOne({ _id: user._id }, { $set: { googleId: sub, avatar: picture, updatedAt: new Date() } });
      user = await db.collection('users').findOne({ _id: user._id });
    }

    if (!user) {
      return NextResponse.json({ error: 'User creation failed' }, { status: 500 });
    }

    // Generate JWT token
    const authToken = createToken({ userId: user._id.toString(), email: user.email });

    return NextResponse.json(
      {
        message: 'Google authentication successful',
        token: authToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in Google auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
