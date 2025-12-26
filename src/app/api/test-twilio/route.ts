import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Check for Twilio credentials
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    console.log('🔍 Checking Twilio credentials...');
    console.log('TWILIO_ACCOUNT_SID:', twilioSid ? `${twilioSid.substring(0, 8)}...` : 'MISSING');
    console.log('TWILIO_AUTH_TOKEN:', twilioToken ? `${twilioToken.substring(0, 8)}...` : 'MISSING');
    console.log('TWILIO_PHONE_NUMBER:', twilioPhone || 'MISSING');

    if (!twilioSid || !twilioToken || !twilioPhone) {
      return NextResponse.json(
        {
          error: 'Twilio credentials not configured',
          details: {
            hasSid: !!twilioSid,
            hasToken: !!twilioToken,
            hasPhone: !!twilioPhone
          }
        },
        { status: 500 }
      );
    }

    // Format phone numbers to E.164
    const formattedTo = formatPhoneNumber(phoneNumber);
    const formattedFrom = formatPhoneNumber(twilioPhone);

    console.log(`📱 Attempting test SMS from ${formattedFrom} to ${formattedTo}`);

    // Send test SMS
    const result = await sendTwilioSMS(
      twilioSid,
      twilioToken,
      formattedFrom,
      formattedTo,
      '🧪 Test message from OwnIt Social portal. If you received this, your Twilio SMS is working correctly!'
    );

    return NextResponse.json({
      success: true,
      message: 'Test SMS sent successfully!',
      details: {
        sid: result.sid,
        status: result.status,
        to: formattedTo,
        from: formattedFrom,
        dateCreated: result.date_created
      }
    });
  } catch (error) {
    console.error('❌ Test SMS error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send test SMS',
        details: error.message
      },
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

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: from,
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
      to: to,
      from: from
    });
    throw new Error(`Twilio error (${error.code}): ${error.message}. More info: ${error.more_info}`);
  }

  const result = await response.json();
  console.log('✅ SMS sent successfully:', {
    sid: result.sid,
    to: to,
    status: result.status,
    dateCreated: result.date_created
  });
  return result;
}
