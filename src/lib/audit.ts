import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',

  // Data access events
  DATA_READ = 'DATA_READ',
  DATA_CREATED = 'DATA_CREATED',
  DATA_UPDATED = 'DATA_UPDATED',
  DATA_DELETED = 'DATA_DELETED',

  // User management events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',

  // Content events
  CONTENT_GENERATED = 'CONTENT_GENERATED',
  CONTENT_REVIEWED = 'CONTENT_REVIEWED',
  CONTENT_APPROVED = 'CONTENT_APPROVED',
  CONTENT_REJECTED = 'CONTENT_REJECTED',

  // Video events
  VIDEO_SUBMITTED = 'VIDEO_SUBMITTED',
  VIDEO_COMPLETED = 'VIDEO_COMPLETED',

  // Admin events
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  BULK_OPERATION = 'BULK_OPERATION',

  // API events
  API_CALL = 'API_CALL',
  API_ERROR = 'API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Security events
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
}

export interface AuditLogEntry {
  timestamp: Timestamp;
  eventType: AuditEventType;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  status: 'success' | 'failure' | 'error';
  message?: string;
  metadata?: Record<string, any>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  try {
    const auditEntry: AuditLogEntry = {
      timestamp: Timestamp.now(),
      ...entry
    };

    // Store in Firestore audit logs collection
    await addDoc(collection(db, 'auditLogs'), auditEntry);

    // Also log to console for immediate visibility during development
    console.log('[AUDIT]', {
      time: new Date().toISOString(),
      event: entry.eventType,
      user: entry.userEmail || 'anonymous',
      status: entry.status,
      resource: entry.resource,
      message: entry.message
    });
  } catch (error) {
    // Audit logging should never break the application
    // Log the error but don't throw
    console.error('[AUDIT ERROR] Failed to create audit log:', error);
  }
}

/**
 * Helper function to log authentication events
 */
export async function logAuthEvent(
  eventType: AuditEventType,
  userId: string | undefined,
  email: string | undefined,
  status: 'success' | 'failure',
  ipAddress?: string,
  message?: string
): Promise<void> {
  await createAuditLog({
    eventType,
    userId,
    userEmail: email,
    status,
    ipAddress,
    message,
    resource: 'authentication'
  });
}

/**
 * Helper function to log data access events
 */
export async function logDataAccess(
  eventType: AuditEventType,
  userId: string,
  userEmail: string,
  resource: string,
  resourceId: string,
  action: string,
  status: 'success' | 'failure'
): Promise<void> {
  await createAuditLog({
    eventType,
    userId,
    userEmail,
    resource,
    resourceId,
    action,
    status
  });
}

/**
 * Helper function to log API calls
 */
export async function logApiCall(
  endpoint: string,
  userId?: string,
  userEmail?: string,
  status: 'success' | 'failure' | 'error' = 'success',
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    eventType: AuditEventType.API_CALL,
    userId,
    userEmail,
    resource: 'api',
    action: endpoint,
    status,
    metadata
  });
}

/**
 * Helper function to log security events
 */
export async function logSecurityEvent(
  eventType: AuditEventType,
  userId: string | undefined,
  userEmail: string | undefined,
  message: string,
  ipAddress?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    eventType,
    userId,
    userEmail,
    status: 'failure',
    message,
    ipAddress,
    resource: 'security',
    metadata
  });
}
