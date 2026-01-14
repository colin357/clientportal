import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { verifyPassword, generateToken } from '@/lib/auth';
import { logAuthEvent, AuditEventType } from '@/lib/audit';
import { rateLimit } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Input validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(email, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Query Firestore for user
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      await logAuthEvent(
        AuditEventType.LOGIN_FAILED,
        undefined,
        email,
        'failure',
        request.ip,
        'User not found'
      );

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    // Verify password
    const isValidPassword = await verifyPassword(password, userData.password || '');

    if (!isValidPassword) {
      await logAuthEvent(
        AuditEventType.LOGIN_FAILED,
        userData.id,
        email,
        'failure',
        request.ip,
        'Invalid password'
      );

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken(userData.id, userData.email, 'client');

    await logAuthEvent(
      AuditEventType.USER_LOGIN,
      userData.id,
      email,
      'success',
      request.ip
    );

    // Return user data and token (exclude password)
    const { password: _, ...userWithoutPassword } = userData;

    return NextResponse.json({
      success: true,
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
