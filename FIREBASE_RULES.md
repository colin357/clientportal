# Firebase Security Rules Guide

This guide will help you set up Firestore security rules for your Client Portal application.

## Quick Setup

### For Testing/Development (Open Access)

If you just want to get started quickly and test that Firebase is working, use these permissive rules:

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

⚠️ **WARNING**: These rules allow ANYONE to read and write ALL your data. Only use for development/testing!

### For Production (Recommended)

For a production app, you'll want more secure rules. See the sections below.

---

## How to Apply Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Firestore Database** in the left sidebar
4. Click the **Rules** tab at the top
5. Copy and paste your chosen rules into the editor
6. Click **Publish**

---

## Security Rules Options

You have three options depending on your app's stage:

### Option 1: Test Mode (Current - Not Secure)

**When to use:** Just getting started, testing locally, debugging

**Rules:**
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

**Pros:**
- ✅ Easy to get started
- ✅ No authentication needed
- ✅ Good for testing

**Cons:**
- ❌ Anyone can read all your data
- ❌ Anyone can write/delete anything
- ❌ Not suitable for production

---

### Option 2: Basic Security (Without Authentication)

**When to use:** You want some basic security but haven't implemented Firebase Authentication yet

**Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection - Anyone can create, users can only read/update their own data
    match /users/{userId} {
      // Anyone can create a new user (signup)
      allow create: if true;

      // Users can read their own data
      allow read: if request.auth != null || true; // Temporarily allow all reads

      // Users can update their own data
      allow update: if request.auth != null || true; // Temporarily allow all updates

      // Only allow delete if you're the owner (or admin)
      allow delete: if request.auth != null || true; // Temporarily allow all deletes
    }

    // Content collection - Clients can only see their own content
    match /content/{contentId} {
      allow read, write: if true; // Allow all for now
    }

    // Videos collection - Clients can only see their own videos
    match /videos/{videoId} {
      allow read, write: if true; // Allow all for now
    }
  }
}
```

⚠️ **Note:** These rules still allow broad access. They're slightly better than test mode but not production-ready.

---

### Option 3: Production Security (Recommended - Requires Changes to Your App)

**When to use:** Production deployment with proper security

**What you need first:**
1. Implement Firebase Authentication in your app
2. Use Firebase Auth instead of storing passwords in Firestore
3. Update your login/signup flow to use Firebase Auth

**Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isAdmin() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users collection
    match /users/{userId} {
      // Anyone can create a user account (signup)
      allow create: if true;

      // Users can read their own profile and admins can read all
      allow read: if isSignedIn() && (isOwner(userId) || isAdmin());

      // Users can update their own profile and admins can update any
      allow update: if isSignedIn() && (isOwner(userId) || isAdmin());

      // Only admins can delete users
      allow delete: if isAdmin();
    }

    // Content collection
    match /content/{contentId} {
      // Users can create content if they're signed in
      allow create: if isSignedIn();

      // Users can read content if:
      // - They're the client who owns it
      // - They're an admin
      allow read: if isSignedIn() &&
                     (resource.data.clientId == request.auth.uid || isAdmin());

      // Users can update content if:
      // - They're the client who owns it
      // - They're an admin
      allow update: if isSignedIn() &&
                       (resource.data.clientId == request.auth.uid || isAdmin());

      // Only admins can delete content
      allow delete: if isAdmin();
    }

    // Videos collection
    match /videos/{videoId} {
      // Users can create videos if they're signed in
      allow create: if isSignedIn();

      // Users can read videos if:
      // - They're the client who owns it
      // - They're an admin
      allow read: if isSignedIn() &&
                     (resource.data.clientId == request.auth.uid || isAdmin());

      // Users can update videos if:
      // - They're the client who owns it
      // - They're an admin
      allow update: if isSignedIn() &&
                       (resource.data.clientId == request.auth.uid || isAdmin());

      // Only admins can delete videos
      allow delete: if isAdmin();
    }
  }
}
```

---

## Recommended Approach

### Phase 1: Get It Working (Now)

Use **Option 1 (Test Mode)** to verify Firebase integration works:

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

**Important:** Set a reminder to update these before launching publicly!

### Phase 2: Add Basic Protection (Soon)

Once Firebase is working, switch to **Option 2** for basic security without major code changes.

### Phase 3: Production Security (Before Launch)

Before launching publicly, implement Firebase Authentication and use **Option 3**.

---

## Implementing Firebase Authentication (For Production)

To use the secure Option 3 rules, you'll need to update your app:

### 1. Install Firebase Auth

Already installed with `firebase` package ✅

### 2. Update imports in page.tsx

```javascript
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
```

### 3. Initialize Auth

```javascript
const auth = getAuth(app);
```

### 4. Update Signup Function

```javascript
const handleSignup = async (email, password, companyName, firstName) => {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Create user document in Firestore
    const newUser = {
      id: firebaseUser.uid, // Use Firebase Auth UID
      email,
      companyName,
      firstName,
      onboarded: false,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    setCurrentUser(newUser);
    setView('onboarding');
  } catch (error) {
    console.error('Signup error:', error);
    // Handle error
  }
};
```

### 5. Update Login Function

```javascript
const handleLogin = async (email, password) => {
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      setCurrentUser(userData);
      setView(userData.onboarded ? 'dashboard' : 'onboarding');
      return true;
    }
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
};
```

### 6. Update Logout

```javascript
const handleLogout = async () => {
  await signOut(auth);
  setCurrentUser(null);
  setView('login');
};
```

---

## Testing Your Rules

### Test in Firebase Console

1. Go to Firestore Database → Rules tab
2. Click **Rules Simulator** (if available)
3. Test different operations

### Test in Your App

1. Open browser console (F12)
2. Try different operations:
   - Create a user
   - Login
   - Add content
   - View other users' data (should fail with secure rules)

---

## Common Security Rule Patterns

### Allow only document owner

```javascript
allow read, write: if request.auth.uid == resource.data.userId;
```

### Allow if user is admin

```javascript
allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
```

### Allow if signed in

```javascript
allow read: if request.auth != null;
```

### Allow everyone (testing only)

```javascript
allow read, write: if true;
```

### Validate data fields

```javascript
allow create: if request.resource.data.keys().hasAll(['email', 'companyName', 'firstName']);
```

---

## Troubleshooting

### Error: "Missing or insufficient permissions"

**Cause:** Your security rules don't allow the operation

**Solutions:**
1. Check which rules are currently active in Firebase Console
2. Verify your rules match your app's data access patterns
3. For testing, temporarily use test mode rules
4. Check browser console for specific error details

### Error: "Permission denied"

**Cause:** User isn't authenticated or doesn't have access

**Solutions:**
1. Verify user is logged in (`request.auth != null`)
2. Check if user has the required role/ownership
3. Review your rule conditions

### Users can see each other's data

**Cause:** Rules are too permissive

**Solutions:**
1. Add conditions to check `resource.data.clientId == request.auth.uid`
2. Implement proper authentication
3. Use field-level security

---

## Quick Reference

| Scenario | Rule |
|----------|------|
| Testing only | `allow read, write: if true;` |
| Signed-in users only | `allow read, write: if request.auth != null;` |
| Owner only | `allow read, write: if request.auth.uid == resource.data.userId;` |
| Admin only | `allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';` |
| Create only | `allow create: if true;` |
| Read only | `allow read: if true;` |

---

## Next Steps

1. **Right now:** Apply Test Mode rules to get Firebase working
2. **This week:** Test all features work with Firebase
3. **Before launch:** Implement Firebase Authentication
4. **Before launch:** Apply Production security rules
5. **After launch:** Monitor Firebase usage and security

---

## Additional Resources

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Security Rules Simulator](https://firebase.google.com/docs/rules/simulator)

---

## Support

If you encounter issues:
1. Check browser console for specific error messages
2. Review Firebase Console → Firestore → Rules tab
3. Test with permissive rules first, then gradually restrict
4. Ensure your app code matches your security rules logic
