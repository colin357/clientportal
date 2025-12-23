import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { user, onboardingAnswers } = await request.json();

    // Validate required fields
    if (!user || !onboardingAnswers) {
      return NextResponse.json(
        { error: 'Missing user or onboarding answers' },
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

    // Build personalized prompt
    const industry = Array.isArray(onboardingAnswers.industry) ? onboardingAnswers.industry.join(', ') : onboardingAnswers.industry || 'real estate or mortgage';
    const targetAudience = Array.isArray(onboardingAnswers.targetAudience) ? onboardingAnswers.targetAudience.join(', ') : onboardingAnswers.targetAudience || 'general audience';
    const goals = Array.isArray(onboardingAnswers.goals) ? onboardingAnswers.goals.join(', ') : onboardingAnswers.goals || 'marketing';
    const brandVoice = Array.isArray(onboardingAnswers.brandVoice) ? onboardingAnswers.brandVoice.join(', ') : onboardingAnswers.brandVoice || 'professional';

    const prompt = `You are a professional marketing content creator. Generate 5 diverse, high-quality marketing content pieces for ${user.companyName}, a ${industry} business.

Target Audience: ${targetAudience}
Goals: ${goals}
Brand Voice: ${brandVoice}
${onboardingAnswers.differentiators ? `What makes them unique: ${onboardingAnswers.differentiators}` : ''}
${onboardingAnswers.primaryMarkets ? `Primary Markets: ${onboardingAnswers.primaryMarkets}` : ''}

Please create:
1. One engaging social media post
2. One email marketing campaign idea
3. One blog post topic with outline
4. One content idea for audience engagement
5. One call-to-action focused post

For each piece, provide:
- Type (social/email/blog/content-idea)
- Title
- Complete content
- Brief description

Format as JSON array with objects containing: type, title, content, description`;

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
            content: 'You are a professional marketing content writer specializing in real estate and mortgage industries. Always respond with valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.8,
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
    const contentText = data.choices[0]?.message?.content || '[]';

    // Try to parse as JSON, fallback to simple content if parsing fails
    let contentPieces;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = contentText.replace(/```json\n?|\n?```/g, '').trim();
      contentPieces = JSON.parse(cleanedContent);
    } catch (e) {
      // Fallback: create simple content from the response
      contentPieces = [{
        type: 'content-idea',
        title: 'Generated Marketing Content',
        content: contentText,
        description: 'AI-generated marketing content for your business'
      }];
    }

    return NextResponse.json({ contentPieces });
  } catch (error) {
    console.error('Error generating personalized content:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
