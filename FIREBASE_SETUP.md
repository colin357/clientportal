# Firebase Setup Guide

This guide will help you set up Firebase Firestore to store user login information and data in the cloud.

## Prerequisites
- A Google account
- Node.js and npm installed

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter a project name (e.g., "client-portal")
4. Follow the setup wizard (you can disable Google Analytics if not needed)
5. Click **"Create Project"**

## Step 2: Set Up Firestore Database

1. In your Firebase project, click on **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in test mode"** (you can update security rules later)
4. Select a Firestore location closest to your users
5. Click **"Enable"**

## Step 3: Get Your Firebase Configuration

1. In the Firebase Console, click the gear icon (⚙️) next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"**
4. Click the **Web icon** (</>) to add a web app
5. Register your app with a nickname (e.g., "Client Portal Web")
6. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and replace the placeholder values with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

## Step 5: Install Firebase SDK

Run the following command to install Firebase:
```bash
npm install firebase
```

## Step 6: Set Up Firestore Security Rules (Recommended)

1. In Firebase Console, go to **Firestore Database**
2. Click on the **"Rules"** tab
3. Update the rules for better security:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }

    // Content collection
    match /content/{contentId} {
      allow read, write: if request.auth != null;
    }

    // Videos collection
    match /videos/{videoId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Note:** The above rules require authentication. For now, you can keep test mode enabled, but for production, you should implement Firebase Authentication and use these secure rules.

## Step 7: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your app and try:
   - Creating a new user account
   - Logging in
   - Adding content
   - Submitting videos

3. Verify the data is being saved by checking your Firestore Console:
   - Go to Firebase Console → Firestore Database
   - You should see collections: `users`, `content`, `videos`

## Firestore Collections Structure

### Users Collection (`users`)
- **Document ID**: User ID (auto-generated timestamp)
- **Fields**:
  - `id`: string
  - `email`: string
  - `password`: string (Note: In production, use Firebase Authentication instead)
  - `companyName`: string
  - `firstName`: string
  - `onboarded`: boolean
  - `onboardingAnswers`: object
  - `socialLogins`: object
  - `parentClientId`: string (for team members)
  - `createdAt`: string (ISO date)

### Content Collection (`content`)
- **Document ID**: Content ID (auto-generated timestamp)
- **Fields**:
  - `id`: string
  - `clientId`: string
  - `type`: string (content-idea, email, landing-page, blog, social)
  - `title`: string
  - `description`: string
  - `content`: string
  - `fileLink`: string
  - `status`: string (pending, approved, rejected)
  - `feedback`: string
  - `createdAt`: string (ISO date)
  - `reviewedAt`: string (ISO date)

### Videos Collection (`videos`)
- **Document ID**: Video ID (auto-generated timestamp)
- **Fields**:
  - `id`: string
  - `clientId`: string
  - `videoLink`: string
  - `description`: string
  - `status`: string (pending, in-progress, completed)
  - `completedLink`: string
  - `submittedAt`: string (ISO date)
  - `completedAt`: string (ISO date)

## Security Best Practices

1. **Never commit `.env.local`** to version control (it's in `.gitignore`)
2. **Use Firebase Authentication** in production instead of storing passwords
3. **Update Firestore security rules** before going live
4. **Enable App Check** to protect your Firebase resources
5. **Monitor usage** in Firebase Console to avoid unexpected costs

## Troubleshooting

### Error: "Firebase: No Firebase App '[DEFAULT]' has been created"
- Make sure your `.env.local` file is properly configured
- Restart your development server after updating environment variables

### Error: "Permission denied"
- Check your Firestore security rules
- Make sure you're in "test mode" during development

### Data not saving
- Check browser console for errors
- Verify Firebase configuration is correct
- Check Firebase Console → Firestore Database to see if data is appearing

## Next Steps

1. Consider implementing **Firebase Authentication** for better security
2. Set up **Cloud Functions** for server-side logic
3. Configure **Firebase Storage** if you need to store actual video files
4. Set up **monitoring and alerts** in Firebase Console

## Support

For more information, visit:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Console](https://console.firebase.google.com/)
