import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth';
import { logAuthEvent, AuditEventType } from '@/lib/audit';
import { rateLimit, isValidEmail, isValidPhoneNumber } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  try {
    const { email, password, companyName, firstName, lastName, phoneNumber } = await request.json();

    // Input validation
    if (!email || !password || !companyName || !firstName || !lastName || !phoneNumber) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone number format (E.164)
    if (!isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please use E.164 format (e.g., +12223334444)' },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(request.ip || 'unknown', 3, 60 * 60 * 1000); // 3 signups per hour per IP
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Validate password policy
    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Check if user already exists
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      await logAuthEvent(
        AuditEventType.LOGIN_FAILED,
        undefined,
        email,
        'failure',
        request.ip,
        'Email already registered'
      );

      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const userId = Date.now().toString();
    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
      companyName,
      firstName,
      lastName,
      phoneNumber,
      onboarded: false,
      createdAt: new Date().toISOString()
    };

    // Save to Firestore
    await setDoc(doc(db, 'users', userId), newUser);

    await logAuthEvent(
      AuditEventType.USER_CREATED,
      userId,
      email,
      'success',
      request.ip
    );

    // Return user data (exclude password)
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
