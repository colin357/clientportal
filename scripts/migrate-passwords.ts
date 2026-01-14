/**
 * Password Migration Script
 *
 * This script migrates existing plaintext passwords in Firestore to bcrypt hashed passwords.
 *
 * IMPORTANT: Run this ONCE before deploying the new authentication system.
 *
 * Usage:
 *   npx tsx scripts/migrate-passwords.ts
 *
 * Prerequisites:
 *   npm install tsx
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const SALT_ROUNDS = 12;
const ADMIN_EMAIL = 'admin@ownitsocial.com';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!@#$'; // Strong default password for admin

async function migratePasswords() {
  console.log('🔐 Password Migration Script Starting...\n');

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);

    console.log(`📊 Found ${querySnapshot.size} users to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let createdAdmin = false;

    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      console.log(`\n👤 Processing user: ${userData.email || userId}`);

      // Check if password is already hashed (bcrypt hashes start with $2)
      if (userData.password && userData.password.startsWith('$2')) {
        console.log('   ⏭️  Password already hashed, skipping...');
        skippedCount++;
        continue;
      }

      try {
        // Hash the existing password
        const hashedPassword = await bcrypt.hash(userData.password || 'ChangeMe123!@#', SALT_ROUNDS);

        // Update user document
        await updateDoc(doc(db, 'users', userId), {
          password: hashedPassword,
          passwordMigratedAt: new Date().toISOString()
        });

        console.log('   ✅ Password hashed and updated');
        migratedCount++;
      } catch (error) {
        console.error('   ❌ Error migrating password:', error);
        errorCount++;
      }
    }

    // Check if admin user exists, if not create one
    const adminExists = querySnapshot.docs.some(doc => doc.data().email === ADMIN_EMAIL);

    if (!adminExists) {
      console.log('\n\n🔧 Creating admin user...');

      const hashedAdminPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
      const adminId = 'admin-' + Date.now();

      const adminUser = {
        id: adminId,
        email: ADMIN_EMAIL,
        password: hashedAdminPassword,
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        companyName: 'OwnIt Social',
        onboarded: true,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'users', adminId), adminUser);

      console.log('✅ Admin user created');
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log(`   Password: ${DEFAULT_ADMIN_PASSWORD}`);
      console.log('   ⚠️  IMPORTANT: Change this password immediately after first login!');
      createdAdmin = true;
    }

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Migrated: ${migratedCount} users`);
    console.log(`⏭️  Skipped (already hashed): ${skippedCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    if (createdAdmin) {
      console.log(`🔧 Created admin user: ${ADMIN_EMAIL}`);
    }
    console.log('='.repeat(60));

    if (createdAdmin) {
      console.log('\n⚠️  CRITICAL: Log in as admin and change the default password immediately!');
    }

    console.log('\n✅ Password migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePasswords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
