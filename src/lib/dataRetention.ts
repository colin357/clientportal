/**
 * Data Retention and Deletion Policies
 * SOC2 Compliant Data Lifecycle Management
 */

import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { createAuditLog, AuditEventType } from './audit';

/**
 * Data Retention Periods (in days)
 * These comply with SOC2 requirements and industry best practices
 */
export const RETENTION_PERIODS = {
  // Audit logs: Keep for 7 years for compliance
  AUDIT_LOGS: 365 * 7,

  // User data: Keep indefinitely while account is active
  // Delete 30 days after account deletion request
  USER_DATA_AFTER_DELETION: 30,

  // Content: Keep for 2 years after creation
  CONTENT: 365 * 2,

  // Videos: Keep for 2 years after upload
  VIDEOS: 365 * 2,

  // Calendar events: Keep for 1 year after event date
  CALENDAR_EVENTS: 365,

  // Session logs: Keep for 90 days
  SESSION_LOGS: 90,

  // Failed login attempts: Keep for 30 days
  FAILED_LOGIN_ATTEMPTS: 30
};

/**
 * Delete user and all associated data
 * Implements "Right to be Forgotten" (GDPR/Privacy compliance)
 */
export async function deleteUserData(
  userId: string,
  requestedBy: string,
  requestedByEmail: string
): Promise<{ success: boolean; deletedItems: number; errors: string[] }> {
  const errors: string[] = [];
  let deletedItems = 0;

  try {
    // Log the data deletion request
    await createAuditLog({
      eventType: AuditEventType.USER_DELETED,
      userId: requestedBy,
      userEmail: requestedByEmail,
      status: 'success',
      message: `User data deletion requested for user: ${userId}`,
      metadata: { targetUserId: userId }
    });

    // Delete user's content
    const contentQuery = query(collection(db, 'content'), where('clientId', '==', userId));
    const contentSnapshot = await getDocs(contentQuery);
    for (const contentDoc of contentSnapshot.docs) {
      await deleteDoc(doc(db, 'content', contentDoc.id));
      deletedItems++;
    }

    // Delete user's videos
    const videosQuery = query(collection(db, 'videos'), where('clientId', '==', userId));
    const videosSnapshot = await getDocs(videosQuery);
    for (const videoDoc of videosSnapshot.docs) {
      await deleteDoc(doc(db, 'videos', videoDoc.id));
      deletedItems++;
    }

    // Delete user's calendar events
    const eventsQuery = query(collection(db, 'calendarEvents'), where('clientId', '==', userId));
    const eventsSnapshot = await getDocs(eventsQuery);
    for (const eventDoc of eventsSnapshot.docs) {
      await deleteDoc(doc(db, 'calendarEvents', eventDoc.id));
      deletedItems++;
    }

    // Anonymize or delete the user record
    // For compliance, we keep a minimal record showing the account existed
    // but remove all PII
    await updateDoc(doc(db, 'users', userId), {
      email: `deleted-${userId}@deleted.local`,
      password: 'DELETED',
      firstName: 'DELETED',
      lastName: 'DELETED',
      companyName: 'DELETED',
      phoneNumber: 'DELETED',
      onboardingAnswers: {},
      deletedAt: new Date().toISOString(),
      deletedBy: requestedBy
    });
    deletedItems++;

    // Note: Audit logs are NOT deleted (required for compliance)

    await createAuditLog({
      eventType: AuditEventType.DATA_DELETED,
      userId: requestedBy,
      userEmail: requestedByEmail,
      status: 'success',
      message: `Successfully deleted ${deletedItems} items for user ${userId}`,
      metadata: { targetUserId: userId, deletedItems }
    });

    return {
      success: true,
      deletedItems,
      errors
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);

    await createAuditLog({
      eventType: AuditEventType.DATA_DELETED,
      userId: requestedBy,
      userEmail: requestedByEmail,
      status: 'error',
      message: `Failed to delete user data: ${errorMessage}`,
      metadata: { targetUserId: userId }
    });

    return {
      success: false,
      deletedItems,
      errors
    };
  }
}

/**
 * Clean up expired content based on retention policies
 * Should be run periodically (e.g., daily via cron job)
 */
export async function cleanupExpiredContent(): Promise<{
  success: boolean;
  deletedContent: number;
  deletedVideos: number;
  deletedEvents: number;
}> {
  let deletedContent = 0;
  let deletedVideos = 0;
  let deletedEvents = 0;

  try {
    const now = new Date();

    // Clean up old content (2 years)
    const contentCutoff = new Date(now.getTime() - RETENTION_PERIODS.CONTENT * 24 * 60 * 60 * 1000);
    const contentQuery = query(
      collection(db, 'content'),
      where('createdAt', '<', contentCutoff.toISOString())
    );
    const contentSnapshot = await getDocs(contentQuery);
    for (const contentDoc of contentSnapshot.docs) {
      await deleteDoc(doc(db, 'content', contentDoc.id));
      deletedContent++;
    }

    // Clean up old videos (2 years)
    const videoCutoff = new Date(now.getTime() - RETENTION_PERIODS.VIDEOS * 24 * 60 * 60 * 1000);
    const videosQuery = query(
      collection(db, 'videos'),
      where('submittedAt', '<', videoCutoff.toISOString())
    );
    const videosSnapshot = await getDocs(videosQuery);
    for (const videoDoc of videosSnapshot.docs) {
      await deleteDoc(doc(db, 'videos', videoDoc.id));
      deletedVideos++;
    }

    // Clean up old calendar events (1 year after event date)
    const eventCutoff = new Date(now.getTime() - RETENTION_PERIODS.CALENDAR_EVENTS * 24 * 60 * 60 * 1000);
    const eventsQuery = query(
      collection(db, 'calendarEvents'),
      where('date', '<', eventCutoff.toISOString())
    );
    const eventsSnapshot = await getDocs(eventsQuery);
    for (const eventDoc of eventsSnapshot.docs) {
      await deleteDoc(doc(db, 'calendarEvents', eventDoc.id));
      deletedEvents++;
    }

    // Log the cleanup
    await createAuditLog({
      eventType: AuditEventType.BULK_OPERATION,
      status: 'success',
      message: `Automatic data retention cleanup completed`,
      metadata: {
        deletedContent,
        deletedVideos,
        deletedEvents,
        total: deletedContent + deletedVideos + deletedEvents
      }
    });

    return {
      success: true,
      deletedContent,
      deletedVideos,
      deletedEvents
    };
  } catch (error) {
    console.error('Error during cleanup:', error);

    await createAuditLog({
      eventType: AuditEventType.BULK_OPERATION,
      status: 'error',
      message: `Automatic data retention cleanup failed: ${error}`,
      metadata: { error: String(error) }
    });

    return {
      success: false,
      deletedContent,
      deletedVideos,
      deletedEvents
    };
  }
}

/**
 * Export user data (GDPR "Right to Data Portability")
 */
export async function exportUserData(userId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    // Get user data
    const userDoc = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));
    if (userDoc.empty) {
      return { success: false, error: 'User not found' };
    }
    const userData = userDoc.docs[0].data();

    // Get user's content
    const contentQuery = query(collection(db, 'content'), where('clientId', '==', userId));
    const contentSnapshot = await getDocs(contentQuery);
    const content = contentSnapshot.docs.map(doc => doc.data());

    // Get user's videos
    const videosQuery = query(collection(db, 'videos'), where('clientId', '==', userId));
    const videosSnapshot = await getDocs(videosQuery);
    const videos = videosSnapshot.docs.map(doc => doc.data());

    // Get user's calendar events
    const eventsQuery = query(collection(db, 'calendarEvents'), where('clientId', '==', userId));
    const eventsSnapshot = await getDocs(eventsQuery);
    const events = eventsSnapshot.docs.map(doc => doc.data());

    // Compile data export (excluding password)
    const { password, ...userDataWithoutPassword } = userData;
    const exportData = {
      exportDate: new Date().toISOString(),
      user: userDataWithoutPassword,
      content,
      videos,
      calendarEvents: events
    };

    // Log the export
    await createAuditLog({
      eventType: AuditEventType.DATA_READ,
      userId,
      userEmail: userData.email,
      status: 'success',
      message: 'User data exported',
      resource: 'user-export'
    });

    return {
      success: true,
      data: exportData
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
