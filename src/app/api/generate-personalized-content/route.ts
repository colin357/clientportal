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

    const prompt = `You are a professional marketing content creator. Generate a total of 15 marketing content pieces (5 social posts, 5 blog posts, 5 emails) for ${user.companyName}, a ${industry} business.

SPEAKER INFORMATION (use these exact values when needed):
- Speaker's Name: ${user.firstName} ${user.lastName || ''}
- Company Name: ${user.companyName}

Target Audience: ${targetAudience}
Goals: ${goals}
Brand Voice: ${brandVoice}
${onboardingAnswers.differentiators ? `What makes them unique: ${onboardingAnswers.differentiators}` : ''}
${onboardingAnswers.primaryMarkets ? `Primary Markets: ${onboardingAnswers.primaryMarkets}` : ''}${historyContext}${adminContext}

CRITICAL: Create EXACTLY 5 pieces of EACH type below. NO MORE, NO LESS. Total output must be exactly 15 pieces.

**Social Media Posts (EXACTLY 5 pieces - NOT 15):**
- Each post MUST include three parts:
  1. Title: Catchy title for the content
  2. Video Script: A complete 45-90 second video script (conversational, engaging, with hook, value, and CTA)
  3. Caption: Instagram/Facebook caption with emojis, hooks, and hashtags
- Vary the style: educational, inspirational, promotional, storytelling, engagement-focused
- Make scripts natural and conversational as if speaking to camera
- CRITICAL: Scripts must be PACKED with specific, actionable details and valuable information
- Include CONCRETE examples, specific numbers, step-by-step advice, or insider tips
- Don't just give surface-level advice - provide real depth and practical takeaways
- HUMANIZE THE WRITING: Vary sentence length, use contractions, include personal observations
- Avoid AI phrases like "dive into", "unlock", "leverage", "game-changer", "navigate the landscape"
- Write hooks that sound like real people talking, not marketing copy
- IMPORTANT: DO NOT include self-introductions like "Hi, I'm [name]" or "I'm [name] with [company]" unless it's genuinely necessary for establishing credentials on a specific topic
- Focus on delivering MEANINGFUL INFORMATION and ACTIONABLE ADVICE to the viewer immediately
- Jump straight into the valuable content with a strong hook
- Use the speaker's actual name (${user.firstName} ${user.lastName || ''}) and company name (${user.companyName}) if introductions are needed - NEVER use placeholders like "[first name]" or "[company name]"

**Blog Posts (EXACTLY 5 pieces - NOT 15):**
- Full, comprehensive blog post with title, engaging introduction, detailed main points with subheadings, and strong conclusion
- Topics relevant to ${industry} and ${targetAudience}
- CRITICAL: Aim for 800-1200 words each - these need to be SUBSTANTIAL, in-depth articles
- Make these genuinely valuable, SEO-optimized pieces that could rank on Google
- Include specific examples, case studies, statistics, actionable steps, and expert insights
- Use proper heading structure (H2, H3) for SEO
- Provide real depth and practical value - not surface-level fluff
- Write as if this is going to be a cornerstone piece of content for their website
- HUMANIZE: Write like a knowledgeable friend explaining things, not a textbook
- Mix up paragraph lengths - some short for impact, others longer for depth
- Use "you" and "your" to speak directly to readers
- Avoid stiff, formal language - be conversational while still professional
- NO AI clichés: skip "in today's competitive market", "unlock your potential", "navigate the complexities"

**Email Campaigns (EXACTLY 5 pieces - NOT 15):**
- Subject lines and full email body
- Various purposes: nurture, promotion, newsletter, re-engagement, event invitation
- Personalized and conversion-focused
- Include clear CTAs
- IMPORTANT: DO NOT reference specific dates, months, or years (like "October 2023") - keep content evergreen
- Use relative time references like "this month", "this season", "recently" instead of specific dates
- HUMANIZE: Write emails that sound like they're from a real person, not a corporate template
- Use casual, warm openings - skip generic "I hope this email finds you well"
- Keep sentences punchy and easy to scan
- Avoid buzzwords and corporate jargon - write like you actually talk

For each piece, provide:
- type: "social", "blog", or "email"
- title: Catchy and relevant title
- content: Complete, ready-to-use content
  * For social posts: Format as "VIDEO SCRIPT:\n[script here]\n\nCAPTION:\n[caption here]"
  * For blog/email: The full content text
- description: Brief summary of the piece (for social posts, mention the topic/hook)

REMINDER: Return a JSON array with EXACTLY 15 total objects: 5 social + 5 blog + 5 email = 15 total.`;

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
            content: `You are a professional marketing content writer specializing in real estate and mortgage industries. Always respond with valid JSON arrays containing exactly 15 content pieces (5 social posts, 5 blog posts, 5 email campaigns). Create in-depth, valuable content with specific details and actionable insights.

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
        max_tokens: 12000,
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
