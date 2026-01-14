# SOC2 Compliance Deployment Guide

This guide walks you through deploying the SOC2-compliant version of the Client Portal.

## ⚠️ CRITICAL: Pre-Deployment Checklist

Before deploying to production, complete ALL of these steps:

- [ ] Backup current database
- [ ] Set JWT_SECRET environment variable
- [ ] Run password migration script
- [ ] Update Firebase Security Rules
- [ ] Update Firebase Storage Rules
- [ ] Test authentication flows
- [ ] Change default admin password

## Step 1: Environment Configuration

### Add JWT Secret

Add the following to your `.env.local` file (locally) and Vercel environment variables (production):

```bash
# Generate a secure random secret (32+ characters)
JWT_SECRET=your-super-secure-random-secret-key-here-at-least-32-characters
```

**How to generate a secure JWT secret:**

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Vercel Environment Variable Setup

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add `JWT_SECRET` with the generated value
4. Select all environments (Production, Preview, Development)
5. Click **Save**

## Step 2: Install New Dependencies

The SOC2 implementation requires new npm packages:

```bash
npm install bcryptjs jsonwebtoken express-rate-limit
```

These provide:
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT token generation/verification
- `express-rate-limit` - API rate limiting

## Step 3: Database Backup

### Create Firebase Backup

1. Go to Firebase Console
2. Navigate to **Firestore Database**
3. Click on **Export/Import** (or use gcloud CLI)
4. Export to Google Cloud Storage

**Using gcloud CLI:**
```bash
gcloud firestore export gs://[BUCKET_NAME]/[EXPORT_FOLDER]
```

## Step 4: Run Password Migration Script

This script will:
- Hash all existing plaintext passwords
- Create an admin user if one doesn't exist
- Update user records in Firestore

### Prerequisites

Install tsx for TypeScript execution:
```bash
npm install -D tsx
```

### Run Migration

```bash
npx tsx scripts/migrate-passwords.ts
```

### Expected Output

```
🔐 Password Migration Script Starting...

📊 Found 15 users to process

👤 Processing user: client@example.com
   ✅ Password hashed and updated

👤 Processing user: another@example.com
   ✅ Password hashed and updated

...

🔧 Creating admin user...
✅ Admin user created
   Email: admin@ownitsocial.com
   Password: Admin123!@#$
   ⚠️  IMPORTANT: Change this password immediately after first login!

============================================================
📊 MIGRATION SUMMARY
============================================================
✅ Migrated: 15 users
⏭️  Skipped (already hashed): 0 users
❌ Errors: 0 users
🔧 Created admin user: admin@ownitsocial.com
============================================================

✅ Password migration completed successfully!
```

### ⚠️ CRITICAL: Post-Migration Actions

1. **Test a user login** to verify the migration worked
2. **Log in as admin** using `admin@ownitsocial.com` / `Admin123!@#$`
3. **IMMEDIATELY change the admin password** to something secure

## Step 5: Update Firebase Security Rules

### Firestore Rules

1. Go to Firebase Console
2. Navigate to **Firestore Database** → **Rules**
3. Copy the contents of `firestore.rules` from this repository
4. Paste into the Firebase Console
5. Click **Publish**

### Storage Rules

1. Go to Firebase Console
2. Navigate to **Storage** → **Rules**
3. Copy the contents of `storage.rules` from this repository
4. Paste into the Firebase Console
5. Click **Publish**

### Verify Rules Are Active

After publishing, verify:
- Test mode rules are no longer active
- Authentication is required for data access
- Audit logs are write-only
- User data isolation is enforced

## Step 6: Test Authentication Flows

### Test Client Login

1. Navigate to the login page
2. Try logging in with an existing user
3. Verify:
   - [ ] Login succeeds with correct password
   - [ ] Login fails with incorrect password
   - [ ] JWT token is stored
   - [ ] Dashboard loads correctly

### Test Admin Login

1. Navigate to `/admin` or admin login
2. Log in with admin credentials
3. Verify:
   - [ ] Admin login succeeds
   - [ ] Admin dashboard loads
   - [ ] Admin-only features are accessible

### Test Password Change

1. Log in as a user
2. Navigate to password change (if UI exists)
3. Or test via API endpoint `/api/auth/change-password`
4. Verify:
   - [ ] Current password must be correct
   - [ ] New password must meet policy requirements
   - [ ] Password change succeeds

### Test API Authentication

Test that API endpoints require authentication:

```bash
# Should fail with 401 Unauthorized
curl -X POST https://your-domain.com/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{"topic":"test","contentType":"social","audience":"all","tone":"professional"}'

# Should succeed with valid token
curl -X POST https://your-domain.com/api/generate-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"topic":"test","contentType":"social","audience":"all","tone":"professional"}'
```

## Step 7: Verify Audit Logging

### Check Audit Logs in Firestore

1. Go to Firebase Console
2. Navigate to **Firestore Database**
3. Look for `auditLogs` collection
4. Verify logs are being created for:
   - Login attempts
   - API calls
   - Data access
   - Security events

### Sample Audit Log Entry

```json
{
  "timestamp": "2026-01-14T10:30:00.000Z",
  "eventType": "USER_LOGIN",
  "userId": "12345",
  "userEmail": "user@example.com",
  "userRole": "client",
  "ipAddress": "192.168.1.1",
  "status": "success",
  "resource": "authentication"
}
```

## Step 8: Monitor for Issues

### Check Logs

**Vercel Logs:**
1. Go to Vercel Dashboard
2. Navigate to your project
3. Click on **Logs** tab
4. Monitor for errors related to:
   - Authentication failures
   - JWT token issues
   - Database connection issues

**Firebase Logs:**
1. Go to Firebase Console
2. Navigate to **Firestore Database** → **Usage**
3. Check for unusual patterns

### Common Issues and Solutions

#### Issue: "JWT_SECRET not defined"
**Solution:** Ensure `JWT_SECRET` is set in environment variables and redeploy

#### Issue: "Invalid token"
**Solution:** Tokens may have expired, users need to log in again

#### Issue: "Firestore permission denied"
**Solution:** Verify Firebase Security Rules are published correctly

#### Issue: Users can't log in after migration
**Solution:**
- Check password migration script ran successfully
- Verify bcrypt is installed
- Check for errors in Vercel logs

## Step 9: Change Default Admin Password

**CRITICAL:** The migration script creates an admin user with a default password.

1. Log in as admin:
   - Email: `admin@ownitsocial.com`
   - Password: `Admin123!@#$`

2. Immediately change the password via API or create a UI for this

3. Use a strong password that meets the policy:
   - Minimum 12 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character

**API Method:**
```bash
curl -X POST https://your-domain.com/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "currentPassword": "Admin123!@#$",
    "newPassword": "YourNewSecurePassword123!@#"
  }'
```

## Step 10: Update Documentation

Update any user-facing documentation to reflect:
- New password requirements
- Enhanced security features
- How to change passwords
- How to request data export/deletion

## Step 11: Notify Users (Optional)

Consider sending an email to users informing them of:
- Enhanced security measures
- New password policy (if forcing password resets)
- How to contact support if they have issues

## Verification Checklist

After deployment, verify all of these:

### Security
- [ ] All API endpoints require authentication
- [ ] Rate limiting is active
- [ ] Passwords are hashed in database
- [ ] JWT tokens are being generated and validated
- [ ] Firebase Security Rules are active
- [ ] Storage Rules are active
- [ ] No plaintext passwords in database

### Functionality
- [ ] Users can log in successfully
- [ ] Admin can log in successfully
- [ ] Content generation works
- [ ] SMS sending works
- [ ] File uploads work
- [ ] Dashboard loads correctly

### Compliance
- [ ] Audit logs are being created
- [ ] Audit logs are immutable (write-only)
- [ ] Data retention policies are documented
- [ ] Password policy is enforced
- [ ] User data can be exported
- [ ] User data can be deleted

### Monitoring
- [ ] No errors in Vercel logs
- [ ] No errors in Firebase logs
- [ ] Rate limiting is working (test by making many requests)
- [ ] Failed login attempts are logged

## Rollback Plan

If issues occur after deployment:

### Quick Rollback

1. **Revert Vercel deployment:**
   ```bash
   vercel rollback
   ```

2. **Revert Firebase Rules:**
   - Go to Firebase Console
   - Navigate to Rules
   - Click "Version History"
   - Restore previous version

3. **Restore database backup:**
   ```bash
   gcloud firestore import gs://[BUCKET_NAME]/[EXPORT_FOLDER]
   ```

### Staged Rollout

Consider a staged rollout:
1. Deploy to preview environment first
2. Test thoroughly
3. Deploy to production
4. Monitor closely for 24 hours
5. Be ready to rollback if issues arise

## Post-Deployment Monitoring

Monitor these metrics for the first week:

1. **Authentication Success Rate:**
   - Should be >95%
   - Monitor failed login attempts

2. **API Response Times:**
   - Should remain consistent
   - Watch for slowdowns due to authentication overhead

3. **Error Rates:**
   - Watch for 401/403 errors
   - Investigate any spike in 500 errors

4. **User Reports:**
   - Monitor support channels
   - Respond quickly to login issues

## Next Steps (Recommended)

After successful deployment, consider:

1. **Implement MFA** for admin accounts
2. **Set up monitoring alerts** (e.g., Datadog, New Relic)
3. **Schedule regular security audits**
4. **Implement automated backups testing**
5. **Create incident response playbook**
6. **Conduct user security training**
7. **Set up API key rotation schedule**

## Support

If you encounter issues during deployment:

1. Check the logs (Vercel + Firebase)
2. Review the SOC2_COMPLIANCE.md document
3. Check the migration script output
4. Verify environment variables are set
5. Contact support: [Your support email]

## Compliance Verification

After deployment, you can demonstrate SOC2 compliance by:

1. Showing the audit log implementation
2. Demonstrating password security (hashing)
3. Showing API authentication requirements
4. Demonstrating rate limiting
5. Showing data retention policies
6. Demonstrating user data export/deletion
7. Showing Firebase Security Rules

Provide the `docs/SOC2_COMPLIANCE.md` document to auditors as comprehensive documentation of your security controls.

---

## Deployment Complete! 🎉

Once all steps are complete and verified, your Client Portal is:

✅ **SOC2 Compliant**
✅ **Secure and Production-Ready**
✅ **Auditable with comprehensive logging**
✅ **Protected with industry-standard security measures**

**Remember:**
- Keep JWT_SECRET secure and never commit to Git
- Monitor audit logs regularly
- Conduct regular security reviews
- Keep dependencies updated
- Follow incident response procedures if security events occur

---

**Document Version:** 1.0
**Last Updated:** 2026-01-14
**Author:** Security Team
