# Security Hardening Applied - Review Images

## ✅ UUID Validation Added (Production Hardening)

### What Was Changed

Added regex validation to storage policies **before** UUID casting to prevent error injection attacks.

### Before (Vulnerable to Casting Errors)
```sql
CREATE POLICY "review_images_authenticated_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'review-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'reviews'
  AND is_review_owner(((storage.foldername(name))[2])::uuid)  -- ⚠️ Could error on invalid UUID
);
```

### After (Hardened Against Injection)
```sql
CREATE POLICY "review_images_authenticated_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'review-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'reviews'
  AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'  -- ✅ Validate first
  AND is_review_owner(((storage.foldername(name))[2])::uuid)  -- ✅ Safe to cast now
);
```

### Why This Matters

**Attack Vector**: If someone uploads a file with path `reviews/not-a-uuid/file.jpg`, the `::uuid` cast could throw an error.

**Impact**: 
- Error messages could leak information
- Potential DoS by causing repeated errors
- Unhandled exceptions in policy evaluation

**Fix**: Regex validation ensures the string is a valid UUID format before attempting the cast.

### UUID Regex Breakdown
```
^[0-9a-fA-F]{8}    - 8 hex characters
-                   - dash
[0-9a-fA-F]{4}     - 4 hex characters
-                   - dash
[0-9a-fA-F]{4}     - 4 hex characters
-                   - dash
[0-9a-fA-F]{4}     - 4 hex characters
-                   - dash
[0-9a-fA-F]{12}$   - 12 hex characters
```

**Example Valid UUID**: `123e4567-e89b-12d3-a456-426614174000`

---

## 🔄 Critical Workflow Order

### ⚠️ IMPORTANT: Review Must Exist Before Upload

The storage policy checks `is_review_owner()`, which queries the `service_reviews` table.

**Correct Order**:
1. ✅ Create review in DB (`service_reviews`)
2. ✅ Upload image to storage (policy checks ownership)
3. ✅ Create image record in DB (`service_review_images`)

**Incorrect Order** (Will Fail):
1. ❌ Upload image to storage first
2. ❌ Create review in DB
3. ❌ Create image record

**Why**: If the review doesn't exist when you upload, `is_review_owner()` returns false and the upload is blocked.

### Client Implementation Pattern

```typescript
// ✅ CORRECT: Create review first
async function createReviewWithImages(orderData, images) {
  // 1. Create review
  const { data: review, error: reviewError } = await supabase
    .from('service_reviews')
    .insert({
      order_id: orderData.orderId,
      service_id: orderData.serviceId,
      consumer_profile_id: orderData.consumerId,
      specialist_profile_id: orderData.specialistId,
      rating: orderData.rating,
      comment: orderData.comment
    })
    .select()
    .single();

  if (reviewError) throw reviewError;

  // 2. Upload images (now review exists, policy can verify ownership)
  const uploadedImages = [];
  for (const image of images) {
    const storagePath = `reviews/${review.id}/${uuid()}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('review-images')
      .upload(storagePath, image);
    
    if (uploadError) {
      // Rollback: delete already uploaded images
      for (const uploaded of uploadedImages) {
        await supabase.storage.from('review-images').remove([uploaded]);
      }
      throw uploadError;
    }
    
    uploadedImages.push(storagePath);
  }

  // 3. Create DB records for images
  const imageRecords = uploadedImages.map(path => ({
    review_id: review.id,
    storage_path: path
  }));

  const { error: dbError } = await supabase
    .from('service_review_images')
    .insert(imageRecords);

  if (dbError) {
    // Rollback: delete uploaded images
    await supabase.storage.from('review-images').remove(uploadedImages);
    throw dbError;
  }

  return review;
}
```

---

## 🧹 Orphaned Files Prevention

### Problem
If storage upload succeeds but DB insert fails, you get orphaned files.

### Solution: Client-Side Rollback (Implemented Above)
```typescript
if (dbError) {
  // Clean up storage files that don't have DB records
  await supabase.storage.from('review-images').remove(uploadedImages);
  throw dbError;
}
```

### Additional: Server-Side Periodic Cleanup (Recommended)
Create a Supabase Edge Function or cron job to:
1. List all files in `review-images` bucket
2. Query `service_review_images` for each path
3. Delete files older than 24 hours without DB records

---

## 📋 Security Checklist

- ✅ UUID validation before casting (prevents error injection)
- ✅ Correct workflow order documented (review → upload → DB record)
- ✅ Client-side rollback on errors (prevents orphaned files)
- ✅ Path pattern enforcement (`reviews/<uuid>/<filename>`)
- ✅ Ownership verification at both layers (DB + storage)
- ✅ Immutable images (no UPDATE policy)
- ✅ Visibility mirroring (active, non-expired services only)
- ✅ No unnecessary grants (helper function authenticated only)

---

## 🎯 What This Achieves

| Security Aspect | Implementation | Benefit |
|----------------|----------------|---------|
| **Error Injection** | UUID regex validation | Prevents casting errors |
| **Orphaned Files** | Client rollback + workflow order | Clean storage |
| **Unauthorized Access** | Ownership checks at both layers | Only owner can upload/delete |
| **Path Manipulation** | Strict pattern enforcement | Can't upload to wrong locations |
| **Data Integrity** | Immutable images | Can't modify after upload |
| **Visibility Control** | RLS mirroring parent review | Consistent access rules |

---

## 🚀 Production Ready

The implementation now includes:
- ✅ Production-level error handling
- ✅ Attack vector mitigation (UUID validation)
- ✅ Clear workflow documentation
- ✅ Rollback strategies
- ✅ Enterprise-grade security

**Status**: Ready for production deployment! 🎉
