import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// This endpoint is called automatically by Vercel Cron (daily at 9am UTC)
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request from Vercel
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Cron job triggered: Checking for pending content reminders...');

    // Initialize Firebase
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    let app;
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    const db = getFirestore(app);

    // Load content and users from Firestore
    const contentSnapshot = await getDocs(collection(db, 'content'));
    const content = contentSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    console.log(`📊 Loaded ${content.length} content items and ${users.length} users`);

    // Call the send-reminders API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.ownitsocial.com';
    const response = await fetch(`${baseUrl}/api/send-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, users })
    });

    if (!response.ok) {
      throw new Error('Failed to send reminders');
    }

    const result = await response.json();

    // Update Firestore with new remindersSent data
    if (result.details) {
      const { setDoc, doc } = await import('firebase/firestore');

      for (const reminder of [...result.details.sent48hr, ...result.details.sent7day]) {
        const contentItem = content.find(c => c.id === reminder.itemId);
        if (contentItem) {
          const remindersSent = contentItem.remindersSent || [];

          // Add the appropriate reminder type
          if (result.details.sent48hr.find(r => r.itemId === reminder.itemId)) {
            remindersSent.push('48hr');
          }
          if (result.details.sent7day.find(r => r.itemId === reminder.itemId)) {
            remindersSent.push('7day');
          }

          await setDoc(doc(db, 'content', contentItem.id), {
            ...contentItem,
            remindersSent
          });
        }
      }
    }

    console.log(`✅ Cron job complete: ${result.reminders48hr} 48hr reminders, ${result.reminders7day} 7-day reminders sent`);

    return NextResponse.json({
      success: true,
      message: 'Reminders sent successfully',
      ...result
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
