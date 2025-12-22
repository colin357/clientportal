# Vercel Deployment Guide with Firebase

This guide explains how to deploy your Client Portal to Vercel with Firebase cloud storage.

## Quick Diagnosis

**If your app is deployed but not saving data to Firebase**, open your browser's developer console (F12) and look for these messages:

- ❌ **Red error messages** = Firebase not configured properly
- ✅ **Green checkmarks** = Firebase working correctly
- ⚠️ **Yellow warnings** = Firebase configuration missing

## Part 1: Set Up Firebase (If Not Done)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable **Firestore Database** in test mode
4. Go to **Project Settings** (gear icon) → **General** → **Your apps**
5. Click **Web icon** (</>)  to add a web app
6. Copy your Firebase configuration values (you'll need these for Vercel)

## Part 2: Configure Environment Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Settings** tab
4. Click **Environment Variables** in the left sidebar
5. Add each variable below one by one:

   **Variable 1:**
   - Name: `NEXT_PUBLIC_FIREBASE_API_KEY`
   - Value: Your Firebase API key (e.g., `AIzaSyC...`)
   - Environment: All (Production, Preview, Development)
   - Click **Save**

   **Variable 2:**
   - Name: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - Value: Your auth domain (e.g., `your-project.firebaseapp.com`)
   - Environment: All
   - Click **Save**

   **Variable 3:**
   - Name: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - Value: Your project ID (e.g., `your-project-id`)
   - Environment: All
   - Click **Save**

   **Variable 4:**
   - Name: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - Value: Your storage bucket (e.g., `your-project.appspot.com`)
   - Environment: All
   - Click **Save**

   **Variable 5:**
   - Name: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - Value: Your sender ID (e.g., `123456789012`)
   - Environment: All
   - Click **Save**

   **Variable 6:**
   - Name: `NEXT_PUBLIC_FIREBASE_APP_ID`
   - Value: Your app ID (e.g., `1:123456789012:web:abc...`)
   - Environment: All
   - Click **Save**

6. After adding all variables, go to the **Deployments** tab
7. Click the three dots (**•••**) on your latest deployment
8. Select **Redeploy** → Check "Use existing Build Cache" → Click **Redeploy**

### Method 2: Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Set environment variables
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
# Enter your value when prompted, select all environments

vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# Enter your value when prompted, select all environments

vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
# Enter your value when prompted, select all environments

vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
# Enter your value when prompted, select all environments

vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
# Enter your value when prompted, select all environments

vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
# Enter your value when prompted, select all environments

# Redeploy to apply changes
vercel --prod
```

## Part 3: Verify Configuration

1. **Open your deployed Vercel app** in a browser
2. **Open browser Developer Console** (Press F12 or right-click → Inspect → Console)
3. **Look for Firebase messages:**

   ✅ **SUCCESS - You should see:**
   ```
   ✅ Firebase configuration detected
   Project ID: your-project-id
   ✅ Firebase initialized successfully
   ✅ Firestore connected
   ```

   ❌ **ERROR - If you see this, environment variables are missing:**
   ```
   ❌ Firebase is not properly configured!
   Please set up your Firebase environment variables in Vercel:
   - NEXT_PUBLIC_FIREBASE_API_KEY
   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   ...
   ```

4. **Test the app:**
   - Create a new user account
   - Log in
   - Check console for save messages like:
     ```
     💾 Saving 1 users to Firestore...
     ✅ Saved user: test@example.com (ID: 1234567890)
     ✅ All users saved successfully
     ```

5. **Verify in Firebase Console:**
   - Go to Firebase Console → Firestore Database
   - You should see collections: `users`, `content`, `videos`
   - Click into `users` collection to see saved user data

## Part 4: Common Issues & Solutions

### Issue 1: Environment Variables Not Working

**Symptoms:**
- Console shows "Firebase is not properly configured"
- Environment variables are set but not being read

**Solution:**
1. Make sure variable names start with `NEXT_PUBLIC_` (required for client-side access)
2. Check that variables are set for **all** environments (Production, Preview, Development)
3. **Redeploy** after adding/changing variables (builds are cached)
4. Try a **hard refresh** in browser (Ctrl+Shift+R or Cmd+Shift+R)

### Issue 2: "Permission Denied" Errors

**Symptoms:**
- Firebase connects but operations fail with permission errors
- Console shows: `Missing or insufficient permissions`

**Solution:**
1. Go to Firebase Console → Firestore Database → **Rules** tab
2. Use these rules for testing (WARNING: Not secure for production):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
3. Click **Publish**
4. For production, implement Firebase Authentication and secure rules (see FIREBASE_SETUP.md)

### Issue 3: Data Not Appearing in Firestore

**Symptoms:**
- Console shows "✅ All users saved successfully"
- But data doesn't appear in Firebase Console

**Solution:**
1. Check you're looking at the **correct Firebase project**
2. Verify the `projectId` in console matches your Firebase project
3. Wait a few seconds and refresh Firebase Console
4. Check Firestore indexes if you see index-related errors

### Issue 4: Build Errors on Vercel

**Symptoms:**
- Deployment fails with module errors
- `Cannot find module 'firebase'`

**Solution:**
1. Make sure `firebase` is in dependencies (not devDependencies):
   ```json
   "dependencies": {
     "firebase": "^10.7.1",
     ...
   }
   ```
2. Commit and push `package.json` changes
3. Vercel will automatically rebuild

### Issue 5: Variables Work Locally But Not on Vercel

**Symptoms:**
- App works on `localhost` but not on Vercel deployment
- You have `.env.local` file locally

**Solution:**
- `.env.local` is only for local development (it's in `.gitignore`)
- Vercel deployments need variables configured in Vercel dashboard
- Set all 6 environment variables in Vercel dashboard as shown above

## Part 5: Security Considerations

### For Development/Testing:
- Test mode Firestore rules are fine
- Environment variables are safe to expose client-side (they're meant to be public)

### Before Production:
1. **Implement Firebase Authentication**
   - Don't store passwords in plain text
   - Use Firebase Auth for user management

2. **Update Firestore Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /content/{contentId} {
         allow read, write: if request.auth != null;
       }
       match /videos/{videoId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

3. **Enable App Check** (Firebase Console → App Check)
   - Protects your backend from abuse
   - Ensures requests come from your app

4. **Monitor Usage** (Firebase Console → Usage)
   - Set up billing alerts
   - Monitor Firestore read/write operations

## Part 6: Debugging Checklist

When data is not saving, check these in order:

- [ ] Open browser console (F12)
- [ ] See Firebase configuration messages?
  - If ❌ Red errors → Environment variables not set in Vercel
  - If ✅ Green checks → Firebase is configured correctly
- [ ] Try creating a user account
- [ ] See "💾 Saving users..." message in console?
  - If ⚠️ Warning → Firestore not available
  - If ✅ Success → Data should be in Firebase
- [ ] Check Firebase Console → Firestore Database
- [ ] Do you see the `users` collection?
  - If No → Check Firestore security rules
  - If Yes → Everything is working! 🎉

## Part 7: Need More Help?

1. **Check browser console** - most issues show helpful error messages
2. **Review Firebase Setup Guide** - See `FIREBASE_SETUP.md`
3. **Vercel Logs** - Vercel Dashboard → Deployments → Click deployment → Runtime Logs
4. **Firebase Console** - Check usage, rules, and data

## Quick Reference: All Environment Variables

Copy this checklist to ensure you have all variables:

```
✅ NEXT_PUBLIC_FIREBASE_API_KEY
✅ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
✅ NEXT_PUBLIC_FIREBASE_PROJECT_ID
✅ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
✅ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
✅ NEXT_PUBLIC_FIREBASE_APP_ID
```

**Remember:** After adding/changing variables in Vercel, always **redeploy** for changes to take effect!

---

## Success Indicators

You'll know everything is working when:
1. ✅ Browser console shows "Firebase initialized successfully"
2. ✅ Creating users shows "All users saved successfully"
3. ✅ Firebase Console shows data in collections
4. ✅ You can log in with created accounts across devices

Good luck! 🚀
