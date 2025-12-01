import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, storeOTP } from '@/lib/otp';
import { sendOTPEmail } from '@/lib/email-service';
import { connectToDatabase } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    // Validate input
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email already exists in database
    const { db } = await connectToDatabase();
    const existingUser = await db.collection('users').findOne({ email });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP temporarily
    storeOTP(email, otp);

    // Send OTP via email
    const emailSent = await sendOTPEmail(email, otp, name);

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send OTP email' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        message: 'OTP sent successfully',
        email: email
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
