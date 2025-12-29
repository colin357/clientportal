import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const {
      contentType,
      topic,
      purpose,
      audience,
      user,
      onboardingAnswers,
      previousIdea,
      feedback
    } = await request.json();

    // Validate required fields
    if (!contentType || !topic || !purpose) {
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

    // Build context from onboarding answers
    const industry = Array.isArray(onboardingAnswers?.industry)
      ? onboardingAnswers.industry.join(', ')
      : onboardingAnswers?.industry || 'real estate or mortgage';
    const targetAudience = audience || (Array.isArray(onboardingAnswers?.targetAudience)
      ? onboardingAnswers.targetAudience.join(', ')
      : onboardingAnswers?.targetAudience || 'general audience');
    const goals = Array.isArray(onboardingAnswers?.goals)
      ? onboardingAnswers.goals.join(', ')
      : onboardingAnswers?.goals || 'marketing';
    const brandVoice = Array.isArray(onboardingAnswers?.brandVoice)
      ? onboardingAnswers.brandVoice.join(', ')
      : onboardingAnswers?.brandVoice || 'professional';

    // Build feedback context if regenerating
    let feedbackContext = '';
    if (previousIdea && feedback) {
      feedbackContext = `\n\nPREVIOUS IDEA:
Title: ${previousIdea.title}
Content: ${previousIdea.content}

USER FEEDBACK:
${feedback}

Please revise the content idea based on this feedback. Make the necessary improvements while keeping what worked well.`;
    }

    // Build prompt based on content type
    let contentTypeInstructions = '';
    if (contentType === 'social') {
      contentTypeInstructions = `Create a social media post that includes:
- A catchy, attention-grabbing title
- A complete 30-60 second video script (conversational, engaging, with hook, value, and CTA)
- Caption text with emojis and hashtags

IMPORTANT FOR VIDEO SCRIPTS:
- DO NOT include self-introductions like "Hi, I'm [name]" or "I'm [name] with [company]" unless genuinely necessary for establishing credentials
- Focus on delivering MEANINGFUL INFORMATION and ACTIONABLE ADVICE immediately
- Jump straight into the valuable content with a strong hook
- Use the speaker's actual name (${user.firstName} ${user.lastName || ''}) and company name (${user.companyName}) if introductions are needed

Format the response as:
{
  "title": "Catchy title here",
  "content": "VIDEO SCRIPT:\\n[engaging script]\\n\\nCAPTION:\\n[caption with emojis and hashtags]",
  "description": "Brief summary of the post's value"
}`;
    } else if (contentType === 'blog') {
      contentTypeInstructions = `Create a blog post that includes:
- An SEO-friendly title
- Full blog post with introduction, main points, and conclusion
- Aim for 300-500 words
- Topics relevant to ${industry} and ${targetAudience}

Format the response as:
{
  "title": "SEO-friendly title here",
  "content": "[Full blog post content]",
  "description": "Brief summary of what readers will learn"
}`;
    } else if (contentType === 'email') {
      contentTypeInstructions = `Create an email campaign that includes:
- A compelling subject line
- Full email body with personalization
- Clear call-to-action
- Conversion-focused approach

Format the response as:
{
  "title": "Subject line here",
  "content": "[Full email body]",
  "description": "Brief description of the email's purpose"
}`;
    }

    const prompt = `You are a professional marketing content creator for ${user.companyName}, a ${industry} business.

CONTEXT:
- Topic: ${topic}
- Purpose: ${purpose}
- Target Audience: ${targetAudience}
- Goals: ${goals}
- Brand Voice: ${brandVoice}
${onboardingAnswers?.differentiators ? `- What makes them unique: ${onboardingAnswers.differentiators}` : ''}
${onboardingAnswers?.primaryMarkets ? `- Primary Markets: ${onboardingAnswers.primaryMarkets}` : ''}${feedbackContext}

TASK:
${contentTypeInstructions}

Ensure the content is highly relevant, engaging, and tailored to the specified audience and purpose. Make it actionable and valuable.`;

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
            content: `You are a professional marketing content writer. Always respond with valid JSON containing exactly three fields: "title", "content", and "description". For social media posts, format the content as "VIDEO SCRIPT:\\n[script]\\n\\nCAPTION:\\n[caption]".`
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
        { error: 'Failed to generate content idea' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const ideaText = data.choices[0]?.message?.content || '{}';

    // Parse the idea
    let idea;
    try {
      const cleanedContent = ideaText.replace(/```json\n?|\n?```/g, '').trim();
      idea = JSON.parse(cleanedContent);
    } catch (e) {
      // Fallback if JSON parsing fails
      idea = {
        title: 'Generated Content Idea',
        content: ideaText,
        description: 'AI-generated content for your marketing needs'
      };
    }

    return NextResponse.json({ idea });
  } catch (error) {
    console.error('Error generating AI content idea:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
