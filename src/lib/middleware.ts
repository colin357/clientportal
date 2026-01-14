import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from './auth';
import { logSecurityEvent, AuditEventType } from './audit';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to authenticate API requests using JWT tokens
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ authenticated: boolean; user?: any; response?: NextResponse }> {
  const authHeader = request.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    await logSecurityEvent(
      AuditEventType.UNAUTHORIZED_ACCESS,
      undefined,
      undefined,
      'Missing authentication token',
      request.ip || 'unknown'
    );

    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    };
  }

  const user = verifyToken(token);

  if (!user) {
    await logSecurityEvent(
      AuditEventType.UNAUTHORIZED_ACCESS,
      undefined,
      undefined,
      'Invalid or expired token',
      request.ip || 'unknown'
    );

    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    };
  }

  return {
    authenticated: true,
    user
  };
}

/**
 * Middleware to check if user has admin role
 */
export async function requireAdmin(
  request: NextRequest,
  user: any
): Promise<{ authorized: boolean; response?: NextResponse }> {
  if (user.role !== 'admin') {
    await logSecurityEvent(
      AuditEventType.UNAUTHORIZED_ACCESS,
      user.userId,
      user.email,
      'Attempted to access admin-only resource',
      request.ip || 'unknown'
    );

    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    };
  }

  return { authorized: true };
}

/**
 * Rate limiting store (in-memory for now, should use Redis in production)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiter middleware
 * @param identifier - User ID or IP address
 * @param maxRequests - Maximum requests allowed in the time window
 * @param windowMs - Time window in milliseconds
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || record.resetTime < now) {
    // New window or expired window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    await logSecurityEvent(
      AuditEventType.RATE_LIMIT_EXCEEDED,
      undefined,
      undefined,
      `Rate limit exceeded for ${identifier}`,
      undefined,
      { identifier, limit: maxRequests, window: windowMs }
    );

    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((record.resetTime - now) / 1000))
          }
        }
      )
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(identifier, record);

  return { allowed: true };
}

/**
 * Clean up expired rate limit records (should be called periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * Input validation helper
 */
export function validateInput(
  data: any,
  requiredFields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (E.164 format)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}
