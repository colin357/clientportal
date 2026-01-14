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

    // Rate limiting - 20 content generations per hour per user
    const rateLimitResult = await rateLimit(authResult.user.userId, 20, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { topic, contentType, audience, tone } = await request.json();

    // Log API call
    await logApiCall(
      '/api/generate-content',
      authResult.user.userId,
      authResult.user.email,
      'success',
      { contentType, topic: topic.substring(0, 50) }
    );

    // Validate required fields
    if (!topic || !contentType || !audience || !tone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional marketing content writer. Create compelling, engaging content that resonates with the target audience.'
          },
          {
            role: 'user',
            content: `Create a ${contentType} about ${topic} for ${audience}. The tone should be ${tone}. Please write compelling, engaging content that resonates with this audience.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate content' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || 'No content generated';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
