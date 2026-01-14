import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { hashPassword, verifyPassword, validatePasswordPolicy } from '@/lib/auth';
import { logAuthEvent, AuditEventType } from '@/lib/audit';
import { authenticateRequest } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    const { currentPassword, newPassword } = await request.json();

    // Input validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password policy
    const passwordValidation = validatePasswordPolicy(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'New password does not meet requirements', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Get user from Firestore
    const userRef = doc(db, 'users', authResult.user.userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, userData.password || '');

    if (!isValidPassword) {
      await logAuthEvent(
        AuditEventType.PASSWORD_CHANGED,
        authResult.user.userId,
        authResult.user.email,
        'failure',
        request.ip,
        'Invalid current password'
      );

      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in Firestore
    await updateDoc(userRef, {
      password: hashedPassword,
      passwordChangedAt: new Date().toISOString()
    });

    await logAuthEvent(
      AuditEventType.PASSWORD_CHANGED,
      authResult.user.userId,
      authResult.user.email,
      'success',
      request.ip
    );

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
