# Quick Start: Apply Firebase Security Rules

**Goal:** Get your Firebase working RIGHT NOW so data saves properly.

## Step 1: Copy the Rules

Copy this entire code block:

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

## Step 2: Apply to Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Firestore Database** in left sidebar
4. Click **Rules** tab at the top
5. **DELETE everything** in the editor
6. **PASTE** the rules you copied above
7. Click **Publish** button
8. Confirm by clicking **Publish** again

## Step 3: Test It Works

1. Open your Vercel app
2. Open browser console (F12)
3. Create a new user account
4. Check console for `✅ All users saved successfully`
5. Go to Firebase Console → Firestore Database → Data tab
6. You should see a `users` collection with your new user!

---

## ✅ Done!

Your Firebase should now be saving data correctly!

## ⚠️ Important Next Steps

These rules are **NOT SECURE** for production. They allow anyone to read/write all your data.

**Before launching publicly:**
1. Read `FIREBASE_RULES.md` for secure production rules
2. Implement Firebase Authentication
3. Apply production security rules

**For now:** These test mode rules are perfect for development and testing.

---

## Troubleshooting

**If data still isn't saving:**

1. **Check environment variables** in Vercel:
   - Settings → Environment Variables
   - Verify all 6 `NEXT_PUBLIC_FIREBASE_*` variables are set
   - Redeploy after adding variables

2. **Check browser console:**
   - Look for ❌ errors about Firebase configuration
   - Look for permission denied errors

3. **Check Firebase Console:**
   - Firestore Database → Rules tab
   - Make sure rules show `allow read, write: if true;`
   - Rules must be **Published** (not just saved)

---

Need help? See `VERCEL_DEPLOYMENT.md` for detailed troubleshooting.
