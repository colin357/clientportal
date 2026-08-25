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

    // The generator is gated on onboarding: a brand new signup has no brand
    // profile on file yet, so refuse rather than burn a call on generic output.
    if (!user?.onboarded && !onboardingAnswers) {
      return NextResponse.json(
        { error: 'Complete your onboarding form to unlock the AI Content Generator.' },
        { status: 403 }
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
    const brandVoice = Array.isArray(onboardingAnswers?.brandVoice)
      ? onboardingAnswers.brandVoice.join(', ')
      : onboardingAnswers?.brandVoice || 'professional';
    const specialties = Array.isArray(onboardingAnswers?.specialties)
      ? onboardingAnswers.specialties.join(', ')
      : onboardingAnswers?.specialties || '';

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
- HUMANIZE: Write like real people talk - use contractions, vary sentence length, be conversational
- Avoid AI clichés like "game-changer", "unlock", "dive into", "navigate the landscape"
- Make hooks sound natural and intriguing, not like clickbait templates

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
- HUMANIZE: Write like a knowledgeable friend sharing advice, not a textbook
- Use contractions, vary paragraph lengths, and speak directly to the reader with "you"
- Avoid stiff corporate language and AI clichés ("in today's market", "unlock potential", "leverage")
- Include specific examples and real insights, not generic fluff

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
- HUMANIZE: Write like it's from a real person, not a corporate template
- Skip generic openings like "I hope this email finds you well"
- Use warm, casual language while staying professional
- Keep sentences punchy and scannable
- Avoid buzzwords and jargon - write like you actually talk

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
- Brand Voice: ${brandVoice}
${specialties ? `- Specialties: ${specialties}` : ''}
${onboardingAnswers?.primaryMarkets ? `- Primary Markets: ${onboardingAnswers.primaryMarkets}` : ''}
${onboardingAnswers?.pricePoint ? `- Price Point: ${onboardingAnswers.pricePoint}` : ''}
${onboardingAnswers?.clientPainPoints ? `- Client Pain Points to Address: ${onboardingAnswers.clientPainPoints}` : ''}
${onboardingAnswers?.topicsToAvoid ? `- TOPICS TO AVOID: ${onboardingAnswers.topicsToAvoid}` : ''}${feedbackContext}

TASK:
${contentTypeInstructions}

Ensure the content is highly relevant, engaging, and tailored to the specified audience and purpose. Make it actionable and valuable. Most importantly, make it sound HUMAN - like it was written by a real person with experience, not generated by AI.`;

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
            content: `You are a professional marketing content writer. Always respond with valid JSON containing exactly three fields: "title", "content", and "description". For social media posts, format the content as "VIDEO SCRIPT:\\n[script]\\n\\nCAPTION:\\n[caption]".

CRITICAL - WRITE LIKE A HUMAN, NOT AN AI:
- NEVER use these overused AI phrases: "dive into", "delve into", "unlock", "leverage", "game-changer", "elevate", "empower", "seamless", "robust", "cutting-edge", "navigate", "landscape", "realm", "embark", "foster", "encompass", "firstly/secondly/lastly", "in today's [X]", "in conclusion"
- AVOID generic openings like "Are you looking to..." or "Want to learn how to..."
- VARY your sentence structure - mix short punchy sentences with longer ones
- Use contractions naturally (you're, don't, isn't, we'll, that's)
- Include specific details, numbers, and examples instead of vague claims
- Write like you're talking to a friend who asked for advice - be direct and real
- Have opinions and take stances - don't be wishy-washy
- Use casual transitions like "Here's the thing", "Look", "The truth is", "Real talk"
- Start some sentences with "And" or "But" - it's natural
- Avoid excessive exclamation points and forced enthusiasm
- Skip the generic intros - get to the point quickly
- Sound like a real person with experience, not a corporate brochure`
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
