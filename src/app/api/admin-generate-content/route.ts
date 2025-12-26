import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { users, contentHistory = {} } = await request.json();

    // Validate required fields
    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'No users provided' },
        { status: 400 }
      );
    }

    // Check for API keys
    const openaiKey = process.env.OPENAI_API_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const results = [];
    const errors = [];

    // Process each user
    for (const user of users) {
      try {
        console.log(`🤖 Generating content for ${user.companyName}...`);

        // Skip users without onboarding answers
        if (!user.onboardingAnswers) {
          console.log(`⏭️ Skipping ${user.companyName} - no onboarding answers`);
          continue;
        }

        // Build personalized prompt
        const industry = Array.isArray(user.onboardingAnswers.industry)
          ? user.onboardingAnswers.industry.join(', ')
          : user.onboardingAnswers.industry || 'real estate or mortgage';
        const targetAudience = Array.isArray(user.onboardingAnswers.targetAudience)
          ? user.onboardingAnswers.targetAudience.join(', ')
          : user.onboardingAnswers.targetAudience || 'general audience';
        const goals = Array.isArray(user.onboardingAnswers.goals)
          ? user.onboardingAnswers.goals.join(', ')
          : user.onboardingAnswers.goals || 'marketing';
        const brandVoice = Array.isArray(user.onboardingAnswers.brandVoice)
          ? user.onboardingAnswers.brandVoice.join(', ')
          : user.onboardingAnswers.brandVoice || 'professional';

        // Build conversation history context
        const userHistory = contentHistory[user.id] || [];
        let historyContext = '';
        if (userHistory && userHistory.length > 0) {
          historyContext = `\n\nPREVIOUSLY GENERATED CONTENT (DO NOT REPEAT OR RECYCLE THESE IDEAS):
${userHistory.slice(-20).map((item: any) => `- ${item.title}: ${item.description || ''}`).join('\n')}

IMPORTANT: Generate completely NEW and DIFFERENT ideas from the ones listed above. Avoid repeating topics, angles, or themes.`;
        }

        // Build admin notes context
        let adminContext = '';
        if (user.adminNotes && user.adminNotes.trim()) {
          adminContext = `\n\nADMIN FEEDBACK & PREFERENCES:
${user.adminNotes}

Please take this feedback into account when creating new content.`;
        }

        const prompt = `You are a professional marketing content creator. Generate 15 diverse, high-quality marketing content pieces for ${user.companyName}, a ${industry} business.

Target Audience: ${targetAudience}
Goals: ${goals}
Brand Voice: ${brandVoice}
${user.onboardingAnswers.differentiators ? `What makes them unique: ${user.onboardingAnswers.differentiators}` : ''}
${user.onboardingAnswers.primaryMarkets ? `Primary Markets: ${user.onboardingAnswers.primaryMarkets}` : ''}${historyContext}${adminContext}

Please create EXACTLY 5 pieces of each of the following types (15 total):

**Social Media Posts (5 pieces):**
- Each post MUST include three parts:
  1. Title: Catchy title for the content
  2. Video Script: A complete 30-60 second video script (conversational, engaging, with hook, value, and CTA)
  3. Caption: Instagram/Facebook caption with emojis, hooks, and hashtags
- Vary the style: educational, inspirational, promotional, storytelling, engagement-focused
- Make scripts natural and conversational as if speaking to camera

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
  * For social posts: Format as "VIDEO SCRIPT:\n[script here]\n\nCAPTION:\n[caption here]"
  * For blog/email: The full content text
- description: Brief summary of the piece (for social posts, mention the topic/hook)

Format as a JSON array with exactly 15 objects (5 social, 5 blog, 5 email).`;

        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
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
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const contentText = data.choices[0]?.message?.content || '[]';

        // Parse content pieces
        let contentPieces;
        try {
          const cleanedContent = contentText.replace(/```json\n?|\n?```/g, '').trim();
          contentPieces = JSON.parse(cleanedContent);
        } catch (e) {
          contentPieces = [{
            type: 'content-idea',
            title: 'Generated Marketing Content',
            content: contentText,
            description: 'AI-generated marketing content'
          }];
        }

        // Limit to 15 pieces
        const socialPosts = contentPieces.filter(p => p.type === 'social').slice(0, 5);
        const blogPosts = contentPieces.filter(p => p.type === 'blog').slice(0, 5);
        const emailCampaigns = contentPieces.filter(p => p.type === 'email').slice(0, 5);
        const limitedPieces = [...socialPosts, ...blogPosts, ...emailCampaigns];

        // Send SMS notification if user has phone number
        if (twilioSid && twilioToken && twilioPhone && user.phoneNumber) {
          try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            const credentials = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');

            await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: user.phoneNumber,
                From: twilioPhone,
                Body: `🎉 Great news! We've created ${limitedPieces.length} new personalized marketing pieces for you (${socialPosts.length} social posts, ${blogPosts.length} blog posts, ${emailCampaigns.length} emails). Check your portal to review and approve them!`,
              }),
            });
            console.log(`✅ SMS sent to ${user.companyName}`);
          } catch (smsError) {
            console.error(`Failed to send SMS to ${user.companyName}:`, smsError);
          }
        }

        results.push({
          userId: user.id,
          companyName: user.companyName,
          contentGenerated: limitedPieces.length,
          breakdown: {
            social: socialPosts.length,
            blog: blogPosts.length,
            email: emailCampaigns.length
          },
          contentPieces: limitedPieces
        });

        console.log(`✅ Generated ${limitedPieces.length} pieces for ${user.companyName}`);
      } catch (userError) {
        console.error(`Error generating content for ${user.companyName}:`, userError);
        errors.push({
          userId: user.id,
          companyName: user.companyName,
          error: userError.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      generated: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error in admin content generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
