# Review Images - Quick Reference

## 🎯 What Was Created

### Database Migration
**File**: `20260215_add_review_images.sql`

**Creates**:
- ✅ `service_review_images` table
- ✅ RLS policies (SELECT, INSERT, DELETE)
- ✅ `is_review_owner()` helper function
- ✅ Indexes for performance

### Storage Policies
**File**: `20260215_storage_policies_review_images.sql`

**Creates**:
- ✅ Public READ policy
- ✅ Authenticated INSERT policy (with ownership check)
- ✅ Authenticated DELETE policy (with ownership check)

---

## 📋 Quick Setup (3 Steps)

### 1. Apply Database Migration
```bash
# In Supabase Dashboard SQL Editor:
# Copy and run: 20260215_add_review_images.sql
```

### 2. Create Storage Bucket
```
Dashboard → Storage → New Bucket
- Name: review-images
- Public: YES
- Size limit: 5MB
- MIME types: image/jpeg, image/png, image/webp
```

### 3. Apply Storage Policies
```bash
# In Supabase Dashboard SQL Editor:
# Copy and run: 20260215_storage_policies_review_images.sql
```

---

## 🔒 Security Model

### Database RLS
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Anyone | Service active & not expired |
| INSERT | Owner | auth.uid = review owner |
| DELETE | Owner | auth.uid = review owner |
| UPDATE | No one | Immutable |

### Storage RLS
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Anyone | Bucket = review-images |
| INSERT | Authenticated | Path = reviews/{review_id}/* AND owns review |
| DELETE | Authenticated | Path = reviews/{review_id}/* AND owns review |
| UPDATE | No one | Immutable |

---

## 📁 Path Pattern

**Required**: `reviews/<review_id>/<filename>`

**Examples**:
- ✅ `reviews/123e4567-e89b-12d3-a456-426614174000/photo.jpg`
- ❌ `review/123e4567.jpg` (wrong folder)
- ❌ `123e4567/photo.jpg` (missing 'reviews')

---

## 💻 Client Code Examples

### Upload Image
```typescript
const storagePath = `reviews/${reviewId}/${uuid()}.jpg`;

// 1. Upload to storage
const { data } = await supabase.storage
  .from('review-images')
  .upload(storagePath, file);

// 2. Create DB record
await supabase
  .from('service_review_images')
  .insert({ review_id: reviewId, storage_path: storagePath });

// 3. Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('review-images')
  .getPublicUrl(storagePath);
```

### Delete Image
```typescript
// 1. Delete DB record
await supabase
  .from('service_review_images')
  .delete()
  .eq('id', imageId);

// 2. Delete from storage
await supabase.storage
  .from('review-images')
  .remove([storagePath]);
```

### Fetch Review Images
```typescript
const { data } = await supabase
  .from('service_review_images')
  .select('*')
  .eq('review_id', reviewId);

// Get public URLs
const imageUrls = data.map(img => 
  supabase.storage
    .from('review-images')
    .getPublicUrl(img.storage_path).data.publicUrl
);
```

---

## ✅ Verification

```sql
-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'service_review_images';

-- Check RLS policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'service_review_images';

-- Check storage policies
SELECT policyname FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%review_images%';
```

---

## 🐛 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| RLS policy violation | User doesn't own review | Check auth.uid matches review owner |
| Storage policy violation | Wrong path or not owner | Use `reviews/{id}/*` pattern |
| Images not visible | Bucket is private | Set bucket to public |
| Can't delete | Not owner | Verify ownership |

---

## 📚 Full Documentation

See `REVIEW_IMAGES_SETUP.md` for:
- Detailed setup instructions
- Alternative approaches (private bucket + signed URLs)
- Cleanup strategies
- Testing procedures
- Production checklist

---

## 🎉 Summary

✅ **Secure**: RLS at both DB and storage layers  
✅ **Simple**: 3-step setup process  
✅ **Flexible**: Public or private bucket options  
✅ **Production-ready**: Enterprise-grade security  

Ready to deploy! 🚀
