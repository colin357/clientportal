import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, rateLimit } from '@/lib/middleware';
import { logApiCall } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    // Rate limiting - 10 SMS per hour per user
    const rateLimitResult = await rateLimit(authResult.user.userId, 10, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { to, message } = await request.json();

    // Log API call
    await logApiCall(
      '/api/send-sms',
      authResult.user.userId,
      authResult.user.email,
      'success',
      { to: to.substring(0, 5) + '***' } // Partial phone number for privacy
    );

    // Validate required fields
    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      );
    }

    // Check for Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Twilio credentials not configured');
      return NextResponse.json(
        { error: 'SMS service not configured' },
        { status: 500 }
      );
    }

    // Call Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Twilio API error:', error);
      return NextResponse.json(
        { error: 'Failed to send SMS' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      messageSid: data.sid
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
