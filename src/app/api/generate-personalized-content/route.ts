import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { user, onboardingAnswers, contentHistory = [], adminNotes = '' } = await request.json();

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

    // Build conversation history context
    let historyContext = '';
    if (contentHistory && contentHistory.length > 0) {
      historyContext = `\n\nPREVIOUSLY GENERATED CONTENT (DO NOT REPEAT OR RECYCLE THESE IDEAS):
${contentHistory.slice(-20).map(item => `- ${item.title}: ${item.description || ''}`).join('\n')}

IMPORTANT: Generate completely NEW and DIFFERENT ideas from the ones listed above. Avoid repeating topics, angles, or themes.`;
    }

    // Build admin notes context
    let adminContext = '';
    if (adminNotes && adminNotes.trim()) {
      adminContext = `\n\nADMIN FEEDBACK & PREFERENCES:
${adminNotes}

Please take this feedback into account when creating new content.`;
    }

    const prompt = `You are a professional marketing content creator. Generate 15 diverse, high-quality marketing content pieces for ${user.companyName}, a ${industry} business.

Target Audience: ${targetAudience}
Goals: ${goals}
Brand Voice: ${brandVoice}
${onboardingAnswers.differentiators ? `What makes them unique: ${onboardingAnswers.differentiators}` : ''}
${onboardingAnswers.primaryMarkets ? `Primary Markets: ${onboardingAnswers.primaryMarkets}` : ''}${historyContext}${adminContext}

Please create EXACTLY 5 pieces of each of the following types (15 total):

**Social Media Posts (5 pieces):**
- Engaging posts for platforms like Instagram, Facebook, LinkedIn
- Include hooks, value propositions, and calls-to-action
- Vary the style: educational, inspirational, promotional, storytelling, engagement-focused
- Keep posts concise and platform-appropriate

**Blog Posts (5 pieces):**
- Full blog post with title, introduction, main points, and conclusion
- Topics relevant to ${industry} and ${targetAudience}
- SEO-friendly and valuable content
- Aim for 300-500 words each

**Email Campaigns (5 pieces):**
- Subject lines and full email body
- Various purposes: nurture, promotion, newsletter, re-engagement, event invitation
- Personalized and conversion-focused
- Include clear CTAs

For each piece, provide:
- type: "social", "blog", or "email"
- title: Catchy and relevant title
- content: Complete, ready-to-use content
- description: Brief summary of the piece

Format as a JSON array with exactly 15 objects (5 social, 5 blog, 5 email).`;

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
            content: 'You are a professional marketing content writer specializing in real estate and mortgage industries. Always respond with valid JSON arrays containing exactly 15 content pieces (5 social posts, 5 blog posts, 5 email campaigns).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
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
