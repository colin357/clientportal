import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { verifyPassword, generateToken } from '@/lib/auth';
import { logAuthEvent, AuditEventType } from '@/lib/audit';
import { rateLimit } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Input validation
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Rate limiting - stricter for admin login
    const rateLimitResult = await rateLimit(request.ip || 'admin', 3, 15 * 60 * 1000); // 3 attempts per 15 minutes
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Query Firestore for admin user (email = 'admin@ownitsocial.com' or similar)
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', 'admin@ownitsocial.com'));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      await logAuthEvent(
        AuditEventType.LOGIN_FAILED,
        undefined,
        'admin',
        'failure',
        request.ip,
        'Admin user not found'
      );

      return NextResponse.json(
        { error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    const adminDoc = querySnapshot.docs[0];
    const adminData = adminDoc.data();

    // Verify password
    const isValidPassword = await verifyPassword(password, adminData.password || '');

    if (!isValidPassword) {
      await logAuthEvent(
        AuditEventType.LOGIN_FAILED,
        adminData.id,
        'admin@ownitsocial.com',
        'failure',
        request.ip,
        'Invalid admin password'
      );

      return NextResponse.json(
        { error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    // Generate JWT token with admin role
    const token = generateToken(adminData.id, adminData.email, 'admin');

    await logAuthEvent(
      AuditEventType.ADMIN_ACCESS,
      adminData.id,
      'admin@ownitsocial.com',
      'success',
      request.ip
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: adminData.id,
        email: adminData.email,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
