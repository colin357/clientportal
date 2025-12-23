# Twilio SMS Setup Instructions

## Required Environment Variables for Vercel

You need to add these **3 environment variables** in your Vercel project settings:

### 1. TWILIO_ACCOUNT_SID
- **What it is**: Your Twilio Account SID (Security Identifier)
- **Where to find it**:
  - Log in to https://console.twilio.com/
  - It's displayed on the dashboard under "Account Info"
  - Looks like: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (starts with "AC")

### 2. TWILIO_AUTH_TOKEN
- **What it is**: Your Twilio Auth Token (like a password for API access)
- **Where to find it**:
  - Log in to https://console.twilio.com/
  - It's displayed on the dashboard under "Account Info"
  - Click "Show" to reveal the token
  - Looks like: 32 random characters (letters and numbers)

### 3. TWILIO_PHONE_NUMBER
- **What it is**: Your Twilio phone number that will send the SMS messages
- **Where to find it**:
  - Log in to https://console.twilio.com/
  - Go to Phone Numbers → Manage → Active Numbers
  - Copy your phone number
  - **IMPORTANT**: Must be in E.164 format: `+1XXXXXXXXXX`
  - Example: `+18055551234`

---

## How to Add Environment Variables in Vercel

1. Go to your Vercel project: https://vercel.com/
2. Select your project: **clientportal**
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar
5. Add each variable:
   - **Key**: `TWILIO_ACCOUNT_SID`
   - **Value**: Your Account SID
   - **Environment**: Select all (Production, Preview, Development)
   - Click **Save**
6. Repeat for `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER`
7. **Redeploy** your project for the changes to take effect

---

## Testing SMS Functionality

After adding the environment variables and redeploying:

1. Open your browser console (F12)
2. Upload content or submit a video
3. Look for these console messages:
   - `📱 Sending SMS to: +1XXXXXXXXXX`
   - `✅ SMS sent successfully: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

If you see:
- `❌ SMS failed: SMS service not configured` → Environment variables missing or incorrect
- `❌ SMS failed: Failed to send SMS` → Check Twilio account status or phone number format
- `✅ SMS sent successfully` → Everything working! 🎉

---

## Common Issues

**Problem**: "SMS service not configured"
- **Solution**: Make sure all 3 environment variables are set in Vercel and redeploy

**Problem**: "Invalid 'To' phone number"
- **Solution**: Ensure phone numbers in your database are in E.164 format (+1XXXXXXXXXX)

**Problem**: "The number +1XXXXXXXXXX is unverified"
- **Solution**: If using a trial Twilio account, you need to verify recipient phone numbers at https://console.twilio.com/verified-caller-ids
- **OR** upgrade to a paid Twilio account to send to any number

**Problem**: SMS not received
- **Solution**: Check that the recipient's phone number is correct and in E.164 format
- **Solution**: Check your Twilio logs at https://console.twilio.com/monitor/logs/sms

---

## Current SMS Notifications in the App

The app sends SMS notifications for:

1. ✅ **Content uploaded to user** (admin uploads content)
   - Message: "📝 New {type} ready for review: "{title}". Check your portal to approve or provide feedback!"

2. ✅ **Video submitted by user** (user uploads video)
   - To: Admin (+18056379009)
   - Message: "📹 New video submitted by {companyName}. Check the admin portal to review!"

3. ✅ **Video completed** (admin marks video as completed)
   - Message: "🎥 Great news! Your video "{description}" is ready! Check your portal to view it."

4. ✅ **AI content generated** (admin generates AI content for all users)
   - Message: "🎉 Great news! We've created 15 new personalized marketing pieces for you (5 social posts, 5 blog posts, 5 emails). Check your portal to review and approve them!"

5. ✅ **Bulk content published** (admin publishes to all Realtors/Loan Officers)
   - Message: "📝 New {type} ready for review: "{title}". Check your portal to approve or provide feedback!"
