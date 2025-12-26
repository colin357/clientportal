import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { users, content } = await request.json();

    // Validate required fields
    if (!users || !content) {
      return NextResponse.json(
        { error: 'Missing users or content data' },
        { status: 400 }
      );
    }

    // Check for Twilio credentials
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioSid || !twilioToken || !twilioPhone) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      );
    }

    const now = new Date();
    const remindersSent: any[] = [];
    const errors: any[] = [];

    // Group content by user
    const userContentMap = new Map();
    for (const item of content) {
      if (item.status === 'pending') {
        if (!userContentMap.has(item.clientId)) {
          userContentMap.set(item.clientId, []);
        }
        userContentMap.get(item.clientId).push(item);
      }
    }

    // Process each user with pending content
    for (const [userId, userContent] of userContentMap.entries()) {
      const user = users.find((u: any) => u.id === userId);
      if (!user || !user.phoneNumber) {
        console.log(`⏭️ Skipping user ${userId} - no phone number`);
        continue;
      }

      // Check each piece of pending content for reminder timing
      for (const item of userContent) {
        try {
          const createdAt = new Date(item.createdAt);
          const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          // Initialize reminders array if it doesn't exist
          const reminders = item.reminders || [];
          const has48HourReminder = reminders.some((r: any) => r.type === '48hour');
          const has7DayReminder = reminders.some((r: any) => r.type === '7day');

          let shouldSendReminder = false;
          let reminderType = '';
          let message = '';

          // Check for 48-hour reminder
          if (!has48HourReminder && hoursSinceCreation >= 48) {
            shouldSendReminder = true;
            reminderType = '48hour';
            message = `👋 Hi ${user.firstName}! Just a friendly reminder - you have pending content waiting for your review in the portal. We'd love your feedback! 📝`;
          }
          // Check for 7-day reminder (168 hours)
          else if (has48HourReminder && !has7DayReminder && hoursSinceCreation >= 168) {
            shouldSendReminder = true;
            reminderType = '7day';
            message = `Hi ${user.firstName}, you still have content pending review. Please let us know if you need any changes or have questions! 🙏`;
          }

          if (shouldSendReminder) {
            // Send SMS via Twilio
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            const credentials = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');

            const smsResponse = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: user.phoneNumber,
                From: twilioPhone,
                Body: message,
              }),
            });

            if (smsResponse.ok) {
              remindersSent.push({
                userId: user.id,
                companyName: user.companyName,
                contentId: item.id,
                contentTitle: item.title,
                reminderType,
                sentAt: now.toISOString(),
              });

              console.log(`✅ Sent ${reminderType} reminder to ${user.companyName} for "${item.title}"`);
            } else {
              const error = await smsResponse.text();
              throw new Error(`Twilio error: ${error}`);
            }
          }
        } catch (error: any) {
          console.error(`❌ Error sending reminder for ${item.title}:`, error);
          errors.push({
            userId: user.id,
            contentId: item.id,
            error: error.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent: remindersSent.length,
      details: remindersSent,
      errors,
    });
  } catch (error: any) {
    console.error('Error in check-reminders:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
