import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { content, users } = await request.json();

    if (!content || !users) {
      return NextResponse.json(
        { error: 'Missing content or users data' },
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
    const reminders = {
      sent48hr: [],
      sent7day: [],
      skipped: []
    };

    // Process each pending content item
    for (const item of content) {
      // Skip if not pending
      if (item.status !== 'pending') continue;

      // Skip if no creation date
      if (!item.createdAt) continue;

      const createdDate = new Date(item.createdAt);
      const hoursSinceCreated = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

      const remindersSent = item.remindersSent || [];

      // Find the user
      const user = users.find(u => u.id === item.clientId);
      if (!user || !user.phoneNumber) {
        reminders.skipped.push({ itemId: item.id, reason: 'No user or phone number' });
        continue;
      }

      let reminderSent = false;

      // Check for 7-day reminder (168 hours)
      if (hoursSinceCreated >= 168 && !remindersSent.includes('7day')) {
        try {
          await sendTwilioSMS(
            twilioSid,
            twilioToken,
            twilioPhone,
            user.phoneNumber,
            `⏰ Reminder: You still have content pending review from 7 days ago. "${item.title}" is waiting for your approval. Check your portal: ${process.env.NEXT_PUBLIC_APP_URL || 'https://portal.ownitsocial.com'}`
          );

          reminders.sent7day.push({
            itemId: item.id,
            title: item.title,
            userId: user.id,
            userName: user.companyName
          });

          reminderSent = true;
          item.remindersSent = [...remindersSent, '7day'];
        } catch (error) {
          console.error(`Failed to send 7-day reminder for ${item.id}:`, error);
          reminders.skipped.push({
            itemId: item.id,
            reason: 'SMS send failed',
            error: error.message,
            phoneNumber: user.phoneNumber
          });
        }
      }
      // Check for 48-hour reminder
      else if (hoursSinceCreated >= 48 && !remindersSent.includes('48hr')) {
        try {
          await sendTwilioSMS(
            twilioSid,
            twilioToken,
            twilioPhone,
            user.phoneNumber,
            `⏰ Reminder: You have content ready for review! "${item.title}" has been pending for 2 days. Take a quick look: ${process.env.NEXT_PUBLIC_APP_URL || 'https://portal.ownitsocial.com'}`
          );

          reminders.sent48hr.push({
            itemId: item.id,
            title: item.title,
            userId: user.id,
            userName: user.companyName
          });

          reminderSent = true;
          item.remindersSent = [...remindersSent, '48hr'];
        } catch (error) {
          console.error(`Failed to send 48hr reminder for ${item.id}:`, error);
          reminders.skipped.push({
            itemId: item.id,
            reason: 'SMS send failed',
            error: error.message,
            phoneNumber: user.phoneNumber
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      reminders48hr: reminders.sent48hr.length,
      reminders7day: reminders.sent7day.length,
      skipped: reminders.skipped.length,
      details: reminders
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Format phone number to E.164 format (+1XXXXXXXXXX)
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it already starts with +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Otherwise, add + prefix
  return `+${digits}`;
}

async function sendTwilioSMS(sid: string, token: string, from: string, to: string, message: string) {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = Buffer.from(`${sid}:${token}`).toString('base64');

  // Format phone numbers to E.164
  const formattedTo = formatPhoneNumber(to);
  const formattedFrom = formatPhoneNumber(from);

  console.log(`📱 Attempting to send SMS from ${formattedFrom} to ${formattedTo}`);

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: formattedTo,
      From: formattedFrom,
      Body: message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Twilio API error:', {
      status: response.status,
      code: error.code,
      message: error.message,
      moreInfo: error.more_info,
      to: formattedTo,
      from: formattedFrom
    });
    throw new Error(`Twilio error (${error.code}): ${error.message}. More info: ${error.more_info}`);
  }

  const result = await response.json();
  console.log('✅ SMS sent successfully:', { sid: result.sid, to: formattedTo, status: result.status });
  return result;
}
