# Review Images Setup Guide

## Overview
This guide covers setting up image uploads for service reviews with production-ready security.

## Architecture

### Database Layer
- **Table**: `service_review_images` tracks image metadata
- **RLS Policies**: Mirror parent review visibility and enforce ownership
- **Helper Function**: `is_review_owner()` for storage policy use

### Storage Layer
- **Bucket**: `review-images` (public read)
- **Path Pattern**: `reviews/<review_id>/<uuid>.jpg`
- **Storage Policies**: Public read, authenticated write/delete with ownership checks

---

## Step-by-Step Setup

### 1. Apply Database Migration

**File**: `20260215_add_review_images.sql`

```bash
# In Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy contents of 20260215_add_review_images.sql
# 3. Run the migration
```

**What this creates**:
- ✅ `service_review_images` table
- ✅ RLS policies (SELECT, INSERT, DELETE)
- ✅ `is_review_owner()` helper function
- ✅ Indexes for performance

**Verification**:
```sql
-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'service_review_images';

-- Check RLS policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'service_review_images';

-- Expected policies:
-- service_review_images_select_public (SELECT)
-- service_review_images_insert_owner (INSERT)
-- service_review_images_delete_owner (DELETE)
```

---

### 2. Create Storage Bucket

**In Supabase Dashboard**:

1. Navigate to **Storage** section
2. Click **New Bucket**
3. Configure:
   - **Name**: `review-images`
   - **Public bucket**: ✅ YES (for public read access)
   - **File size limit**: 5 MB (recommended)
   - **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

---

### 3. Apply Storage Policies

**File**: `20260215_storage_policies_review_images.sql`

```bash
# In Supabase Dashboard SQL Editor:
# 1. Copy contents of 20260215_storage_policies_review_images.sql
# 2. Run the storage policies
```

**What this creates**:
- ✅ Public READ policy (anyone can view images)
- ✅ Authenticated INSERT policy (upload only to own reviews)
- ✅ Authenticated DELETE policy (delete only own images)

**Verification**:
```sql
-- Check storage policies exist
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%review_images%';

-- Expected policies:
-- review_images_public_read (SELECT)
-- review_images_authenticated_insert (INSERT)
-- review_images_authenticated_delete (DELETE)
```

---

## Security Model

### Database RLS (service_review_images)

| Operation | Who Can Do It | Conditions |
|-----------|---------------|------------|
| SELECT | Anyone | Parent review's service is active and not expired |
| INSERT | Review owner | auth.uid() matches review's consumer profile user_id |
| DELETE | Review owner | auth.uid() matches review's consumer profile user_id |
| UPDATE | No one | Images are immutable |

### Storage RLS (storage.objects)

| Operation | Who Can Do It | Conditions |
|-----------|---------------|------------|
| SELECT | Anyone | Bucket is 'review-images' |
| INSERT | Authenticated | Path is `reviews/<review_id>/*` AND user owns review |
| DELETE | Authenticated | Path is `reviews/<review_id>/*` AND user owns review |
| UPDATE | No one | Images are immutable |

---

## Path Pattern Enforcement

### Required Format
```
reviews/<review_id>/<filename>
```

### Examples
✅ **Valid**:
- `reviews/123e4567-e89b-12d3-a456-426614174000/abc123.jpg`
- `reviews/550e8400-e29b-41d4-a716-446655440000/photo_1.png`

❌ **Invalid**:
- `review/123e4567.jpg` (wrong folder name)
- `123e4567/abc123.jpg` (missing 'reviews' folder)
- `reviews/abc123.jpg` (missing review_id folder)

### How It Works
Storage policies use `storage.foldername(name)` to extract path parts:
```sql
(storage.foldername(name))[1] = 'reviews'  -- First folder must be 'reviews'
(storage.foldername(name))[2]::uuid        -- Second folder must be valid UUID (review_id)
```

---

## Upload Workflow

### Client-Side Implementation

```typescript
import { supabase } from '@/lib/supabase';

async function uploadReviewImage(
  reviewId: string,
  imageFile: File
): Promise<string | null> {
  try {
    // 1. Generate unique filename
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const storagePath = `reviews/${reviewId}/${fileName}`;

    // 2. Upload to storage (storage policy checks ownership)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('review-images')
      .upload(storagePath, imageFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 3. Create DB record (RLS checks ownership)
    const { data: dbData, error: dbError } = await supabase
      .from('service_review_images')
      .insert({
        review_id: reviewId,
        storage_path: storagePath
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('review-images').remove([storagePath]);
      throw dbError;
    }

    // 4. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('review-images')
      .getPublicUrl(storagePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading review image:', error);
    return null;
  }
}
```

### Delete Workflow

```typescript
async function deleteReviewImage(imageId: string, storagePath: string) {
  try {
    // 1. Delete DB record (RLS checks ownership)
    const { error: dbError } = await supabase
      .from('service_review_images')
      .delete()
      .eq('id', imageId);

    if (dbError) throw dbError;

    // 2. Delete from storage (storage policy checks ownership)
    const { error: storageError } = await supabase.storage
      .from('review-images')
      .remove([storagePath]);

    if (storageError) throw storageError;

    return true;
  } catch (error) {
    console.error('Error deleting review image:', error);
    return false;
  }
}
```

---

## Alternative: Private Bucket + Signed URLs

If the storage policies are too complex or cause issues, use this simpler approach:

### Setup
1. Create **PRIVATE** bucket (not public)
2. Use simpler storage policies (see commented section in storage policies file)
3. Generate signed URLs for viewing images

### Benefits
- ✅ Simpler storage policies
- ✅ More control over access
- ✅ Can set expiration on URLs
- ✅ Can revoke access by regenerating URLs

### Drawbacks
- ❌ Requires server-side URL generation
- ❌ URLs expire (need refresh logic)
- ❌ More complex client implementation

### Implementation
```typescript
// Get signed URL (expires in 1 hour)
const { data, error } = await supabase.storage
  .from('review-images')
  .createSignedUrl(storagePath, 3600);

if (data) {
  const signedUrl = data.signedUrl;
  // Use this URL to display the image
}
```

---

## Cleanup Strategy

### Problem
If storage upload succeeds but DB insert fails, orphaned files accumulate.

### Solution Options

#### Option 1: Client-Side Cleanup (Implemented Above)
```typescript
// In upload function, rollback storage if DB insert fails
if (dbError) {
  await supabase.storage.from('review-images').remove([storagePath]);
  throw dbError;
}
```

#### Option 2: Server-Side Periodic Cleanup (Recommended for Production)
```sql
-- Find orphaned storage files (files without DB records)
-- Run this as a periodic job (e.g., daily via Supabase Edge Function or cron)

-- Pseudo-code:
-- 1. List all files in storage bucket
-- 2. Query service_review_images for each path
-- 3. Delete files that don't have DB records
-- 4. Delete files older than 24 hours without DB records (grace period)
```

#### Option 3: Cascade Delete on Review Deletion
```sql
-- Already implemented via ON DELETE CASCADE
-- When a review is deleted, all image records are automatically deleted
-- Then manually clean up storage files (app responsibility)
```

---

## Testing

### Test SELECT Policy
```sql
-- As anonymous user, should see images for active, non-expired services
SELECT * FROM service_review_images;
```

### Test INSERT Policy
```typescript
// As authenticated user, try to upload to own review (should succeed)
await uploadReviewImage(myReviewId, imageFile);

// Try to upload to someone else's review (should fail)
await uploadReviewImage(otherUserReviewId, imageFile); // RLS blocks this
```

### Test DELETE Policy
```typescript
// As authenticated user, try to delete own image (should succeed)
await deleteReviewImage(myImageId, myStoragePath);

// Try to delete someone else's image (should fail)
await deleteReviewImage(otherImageId, otherStoragePath); // RLS blocks this
```

### Test Path Pattern Enforcement
```typescript
// Valid path (should succeed)
await supabase.storage
  .from('review-images')
  .upload(`reviews/${reviewId}/test.jpg`, file);

// Invalid path (should fail)
await supabase.storage
  .from('review-images')
  .upload(`wrong/${reviewId}/test.jpg`, file); // Storage policy blocks this
```

---

## Troubleshooting

### Issue: "new row violates row-level security policy"
**Cause**: User doesn't own the review they're trying to upload to.
**Fix**: Verify `auth.uid()` matches the review's consumer profile user_id.

### Issue: "storage policy violation"
**Cause**: Path doesn't match required pattern or user doesn't own review.
**Fix**: Ensure path is `reviews/<review_id>/<filename>` and user owns review.

### Issue: Images not visible publicly
**Cause**: Bucket is private or SELECT policy missing.
**Fix**: Ensure bucket is public and `review_images_public_read` policy exists.

### Issue: Can't delete images
**Cause**: User doesn't own the review or DELETE policy missing.
**Fix**: Verify ownership and check `review_images_authenticated_delete` policy exists.

---

## Production Checklist

Before deploying:
- [ ] Database migration applied successfully
- [ ] Storage bucket created (review-images)
- [ ] Storage policies applied successfully
- [ ] Verified RLS policies with test users
- [ ] Tested upload workflow
- [ ] Tested delete workflow
- [ ] Implemented client-side error handling
- [ ] Implemented cleanup strategy
- [ ] Set appropriate file size limits
- [ ] Set allowed MIME types
- [ ] Tested with expired/inactive services

After deploying:
- [ ] Monitor storage usage
- [ ] Monitor orphaned files
- [ ] Set up periodic cleanup job (if needed)
- [ ] Update TypeScript types
- [ ] Create UI components for image upload
- [ ] Add image preview/gallery to reviews

---

## TypeScript Types

Add to `types/database.ts`:

```typescript
export interface ServiceReviewImage {
  id: string;
  review_id: string;
  storage_path: string;
  created_at: string;
}
```

---

## Summary

✅ **Database**: `service_review_images` table with RLS mirroring parent review visibility  
✅ **Storage**: `review-images` bucket with public read, authenticated write/delete  
✅ **Security**: Ownership verified at both DB and storage layers  
✅ **Path Pattern**: Enforced via storage policies  
✅ **Cleanup**: Client-side rollback + optional periodic job  
✅ **Alternative**: Private bucket + signed URLs for simpler setup  

The implementation is production-ready with enterprise-grade security! 🎉
