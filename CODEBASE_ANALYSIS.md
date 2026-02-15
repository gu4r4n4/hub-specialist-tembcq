# Codebase Analysis: Services, Orders, and Profiles

## Executive Summary

This document provides a comprehensive analysis of how services, orders, and profiles are managed in the HUB Specialist marketplace application. It includes current implementation details and a concrete plan for adding:
1. **Service ratings/reviews** by logged-in users
2. **Service expiration dates** to hide expired listings

---

## 1. Files That Read/Write Data

### A. Services (Read/Write)

#### **Read Operations:**
1. **`app/(tabs)/services.tsx`** (Lines 38-51)
   - Fetches services with specialist and category joins
   - Filters by `is_active = true`
   - Supports category filtering and search
   - Orders by `rating_avg DESC`
   ```typescript
   .from('services')
   .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
   .eq('is_active', true)
   ```

2. **`app/(tabs)/(home)/index.tsx`** (Likely similar pattern)
   - Displays featured services on home screen

3. **`app/service/[id].tsx`** (Lines 31-35)
   - Fetches single service by ID with joins
   ```typescript
   .from('services')
   .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
   .eq('id', id)
   .single()
   ```

4. **`app/booking/[serviceId].tsx`** (Lines 37-41)
   - Fetches service for booking form
   ```typescript
   .from('services')
   .select('*, specialist:profiles!specialist_profile_id(*)')
   .eq('id', serviceId)
   .single()
   ```

5. **`app/search.tsx`** (Referenced but not viewed)
   - Likely implements search functionality

#### **Write Operations:**
1. **`app/create-listing.tsx`** (Lines 166-170)
   - Creates new services (specialists only)
   ```typescript
   .from('services')
   .insert({
     specialist_profile_id: profile.id,
     category_id: selectedCategory,
     title, description, price, currency,
     city, is_active: true
   })
   ```

### B. Orders (Read/Write)

#### **Read Operations:**
1. **`app/(tabs)/orders.tsx`** (Lines 34-44)
   - Fetches orders with full joins
   - Filters by consumer_profile_id OR specialist_profile_id based on role
   ```typescript
   .from('orders')
   .select('*, service:services(*), consumer:profiles!consumer_profile_id(*), specialist:profiles!specialist_profile_id(*)')
   .eq(profile.role === 'consumer' ? 'consumer_profile_id' : 'specialist_profile_id', profile.id)
   ```

2. **`app/order/[id].tsx`** (Lines 34-38)
   - Fetches single order with full joins
   ```typescript
   .from('orders')
   .select('*, service:services(*), consumer:profiles!consumer_profile_id(*), specialist:profiles!specialist_profile_id(*)')
   .eq('id', id)
   .single()
   ```

#### **Write Operations:**
1. **`app/booking/[serviceId].tsx`** (Lines 72-84)
   - Creates new orders (consumers only)
   ```typescript
   .from('orders')
   .insert({
     consumer_profile_id: profile.id,
     specialist_profile_id: service.specialist_profile_id,
     service_id: service.id,
     status: 'new',
     scheduled_at, address, comment
   })
   ```

2. **`app/order/[id].tsx`** (Lines 59-62)
   - Updates order status
   ```typescript
   .from('orders')
   .update({ status: newStatus, updated_at: new Date().toISOString() })
   .eq('id', id)
   ```

### C. Profiles (Read/Write)

#### **Read Operations:**
1. **`contexts/AuthContext.tsx`** (Lines 32-36)
   - Fetches user profile on login
   ```typescript
   .from('profiles')
   .select('*')
   .eq('user_id', userId)
   .single()
   ```

2. **Joined in many queries** (services, orders)
   - Profiles are joined via foreign keys in most queries

#### **Write Operations:**
1. **`contexts/AuthContext.tsx`** (Lines 111-117)
   - Creates profile on signup
   ```typescript
   .from('profiles')
   .insert({
     user_id: data.user.id,
     role, full_name
   })
   ```

2. **`app/create-listing.tsx`** (Lines 142-145)
   - Updates profile city when creating listing
   ```typescript
   .from('profiles')
   .update({ city: location.trim() })
   .eq('id', profile.id)
   ```

---

## 2. Rating System Analysis

### Current Implementation

**Database Schema** (from `SUPABASE_SETUP.md` lines 91-92):
```sql
rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
```

**TypeScript Types** (`types/database.ts` lines 39-40):
```typescript
rating_avg: number;
rating_count: number;
```

### Where Ratings Are Used

1. **`app/(tabs)/services.tsx`** (Line 51)
   - Services ordered by `rating_avg DESC`
   
2. **`app/(tabs)/services.tsx`** (Line 185)
   - Displays rating in service cards
   ```typescript
   const ratingText = service.rating_count > 0 
     ? `${service.rating_avg.toFixed(1)} (${service.rating_count})` 
     : 'No ratings';
   ```

3. **`app/service/[id].tsx`** (Line 98)
   - Displays rating on service detail page
   ```typescript
   const ratingText = service.rating_count > 0 
     ? `${service.rating_avg.toFixed(1)} (${service.rating_count} reviews)` 
     : 'No ratings yet';
   ```

### ⚠️ **Critical Finding**
**Ratings are currently static fields with no review submission mechanism!**
- No reviews table exists
- No way for users to submit ratings
- `rating_avg` and `rating_count` are manually set in seed data

---

## 3. Booking Flow Analysis

### Step-by-Step Order Creation

1. **User browses services** (`app/(tabs)/services.tsx` or `app/(tabs)/(home)/index.tsx`)
2. **User taps service** → navigates to `app/service/[id].tsx`
3. **User taps "Book This Service"** (Line 63)
   - Checks if user is logged in (redirects to login if not)
   - Checks if user is consumer (specialists can't book)
   - Navigates to `app/booking/[serviceId].tsx`
4. **User fills booking form** (`app/booking/[serviceId].tsx`)
   - Scheduled date/time (DateTimePicker)
   - Address (required)
   - Additional comments (optional)
5. **User submits** (Lines 72-84)
   - Creates order with fields:
     - `consumer_profile_id`: Current user's profile ID
     - `specialist_profile_id`: Service owner's profile ID
     - `service_id`: Service being booked
     - `status`: 'new'
     - `scheduled_at`: Selected date/time
     - `address`: User-entered address
     - `comment`: Optional notes
6. **Redirect to order detail** (`app/order/[id].tsx`)

### Order Status Workflow

**Status Flow:** `new` → `confirmed` → `in_progress` → `done` (or `cancelled`)

**Permissions:**
- **Consumer**: Can cancel when status is `new` or `confirmed`
- **Specialist**: Can update status through all stages

**Implementation** (`app/order/[id].tsx` lines 133-137):
```typescript
const canConsumerCancel = isConsumer && (order.status === 'new' || order.status === 'confirmed');
const canSpecialistConfirm = isSpecialist && order.status === 'new';
const canSpecialistStart = isSpecialist && order.status === 'confirmed';
const canSpecialistComplete = isSpecialist && order.status === 'in_progress';
const canSpecialistCancel = isSpecialist && order.status !== 'done' && order.status !== 'cancelled';
```

---

## 4. Auth & Session Management

### Authentication Provider

**File:** `contexts/AuthContext.tsx`

**Exported Context:**
```typescript
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email, password, role, fullName) => Promise<{error: any}>;
  signIn: (email, password) => Promise<{error: any}>;
  signInWithGoogle: () => Promise<{error: any}>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

### Session Flow

1. **App initialization** (Lines 61-71)
   - Fetches current session from Supabase
   - If session exists, fetches profile
   - Sets loading to false

2. **Auth state listener** (Lines 73-83)
   - Listens for auth changes (login/logout)
   - Automatically fetches profile when user logs in
   - Clears profile when user logs out

3. **Profile loading** (Lines 29-49)
   - Queries `profiles` table by `user_id`
   - Returns profile with role, full_name, city, etc.

### Supabase Client

**File:** `lib/supabase.ts`

**Configuration:**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
```

**Key Features:**
- Uses AsyncStorage for session persistence
- Auto-refreshes tokens
- Session persists across app restarts

---

## 5. Implementation Plan

### A. Reviews/Ratings System

#### Database Changes

**1. Create reviews table** (`supabase/migrations/20260215_add_reviews.sql`):
```sql
-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  consumer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id) -- One review per order
);

-- Indexes
CREATE INDEX idx_reviews_service_id ON reviews(service_id);
CREATE INDEX idx_reviews_consumer_profile_id ON reviews(consumer_profile_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- RLS Policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can view reviews
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  USING (true);

-- Only consumer of completed order can create review
CREATE POLICY "Consumers can review completed orders"
  ON reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND orders.consumer_profile_id = consumer_profile_id
      AND orders.status = 'done'
      AND auth.uid() = (SELECT user_id FROM profiles WHERE id = consumer_profile_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM reviews WHERE reviews.order_id = order_id
    )
  );

-- Consumers can update their own reviews
CREATE POLICY "Consumers can update their own reviews"
  ON reviews FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = consumer_profile_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = consumer_profile_id)
  );
```

**2. Create function to update service ratings**:
```sql
-- Function to recalculate service ratings
CREATE OR REPLACE FUNCTION update_service_rating(service_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE services
  SET 
    rating_avg = (
      SELECT COALESCE(AVG(rating), 0)
      FROM reviews
      WHERE service_id = service_uuid
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE service_id = service_uuid
    )
  WHERE id = service_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update ratings when review is added/updated/deleted
CREATE OR REPLACE FUNCTION trigger_update_service_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_service_rating(OLD.service_id);
    RETURN OLD;
  ELSE
    PERFORM update_service_rating(NEW.service_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_update_service_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_update_service_rating();
```

#### TypeScript Changes

**1. Add Review type** (`types/database.ts`):
```typescript
export interface Review {
  id: string;
  order_id: string;
  service_id: string;
  consumer_profile_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  consumer?: Profile;
}
```

**2. Create review submission component** (`app/order/[id].tsx`):

Add after line 222 (after comments section):
```typescript
{order.status === 'done' && isConsumer && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Leave a Review</Text>
    <ReviewForm orderId={order.id} serviceId={order.service_id} />
  </View>
)}
```

**3. Create ReviewForm component** (`components/ReviewForm.tsx`):
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';

interface ReviewFormProps {
  orderId: string;
  serviceId: string;
}

export function ReviewForm({ orderId, serviceId }: ReviewFormProps) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExistingReview();
  }, [orderId]);

  const loadExistingReview = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (!error && data) {
        setExistingReview(data);
        setRating(data.rating);
        setComment(data.comment || '');
      }
    } catch (err) {
      console.log('No existing review');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update({
            rating,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingReview.id);

        if (error) throw error;
        alert('Review updated successfully!');
      } else {
        // Create new review
        const { error } = await supabase
          .from('reviews')
          .insert({
            order_id: orderId,
            service_id: serviceId,
            consumer_profile_id: profile!.id,
            rating,
            comment: comment.trim() || null
          });

        if (error) throw error;
        alert('Review submitted successfully!');
        await loadExistingReview();
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="small" color={colors.primary} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rating</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            disabled={submitting}
          >
            <IconSymbol
              ios_icon_name={star <= rating ? 'star.fill' : 'star'}
              android_material_icon_name={star <= rating ? 'star' : 'star-outline'}
              size={32}
              color={star <= rating ? colors.warning : colors.border}
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Comment (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Share your experience..."
        placeholderTextColor={colors.textSecondary}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={4}
        editable={!submitting}
      />

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            {existingReview ? 'Update Review' : 'Submit Review'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**4. Display reviews on service detail page** (`app/service/[id].tsx`):

Add new section after line 160:
```typescript
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Reviews</Text>
  <ReviewsList serviceId={id as string} />
</View>
```

**5. Create ReviewsList component** (`components/ReviewsList.tsx`):
```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Review } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';

interface ReviewsListProps {
  serviceId: string;
}

export function ReviewsList({ serviceId }: ReviewsListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, [serviceId]);

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, consumer:profiles!consumer_profile_id(*)')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="small" color={colors.primary} />;
  }

  if (reviews.length === 0) {
    return <Text style={styles.emptyText}>No reviews yet</Text>;
  }

  return (
    <View style={styles.container}>
      {reviews.map((review) => (
        <View key={review.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewerName}>
              {review.consumer?.full_name || 'Anonymous'}
            </Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <IconSymbol
                  key={star}
                  ios_icon_name={star <= review.rating ? 'star.fill' : 'star'}
                  android_material_icon_name={star <= review.rating ? 'star' : 'star-outline'}
                  size={16}
                  color={star <= review.rating ? colors.warning : colors.border}
                />
              ))}
            </View>
          </View>
          {review.comment && (
            <Text style={styles.reviewComment}>{review.comment}</Text>
          )}
          <Text style={styles.reviewDate}>
            {new Date(review.created_at).toLocaleDateString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  emptyText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  reviewCard: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerName: {
    ...typography.body,
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    ...typography.body,
    lineHeight: 20,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
```

---

### B. Service Expiration Date

#### Database Changes

**1. Add expires_at column** (`supabase/migrations/20260215_add_service_expiration.sql`):
```sql
-- Add expires_at column to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add index for faster expiration queries
CREATE INDEX IF NOT EXISTS idx_services_expires_at ON services(expires_at);

-- Add comment to document the column
COMMENT ON COLUMN services.expires_at IS 'Date/time when the service listing expires and should be hidden';
```

#### TypeScript Changes

**1. Update Service type** (`types/database.ts`):
```typescript
export interface Service {
  id: string;
  specialist_profile_id: string;
  category_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  city?: string;
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  expires_at?: string; // ADD THIS
  created_at: string;
  specialist?: Profile;
  category?: Category;
}
```

**2. Update service queries to filter expired** (`app/(tabs)/services.tsx`):

Modify line 38-41:
```typescript
let servicesQuery = supabase
  .from('services')
  .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
  .eq('is_active', true)
  .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`); // ADD THIS
```

**3. Update create-listing form** (`app/create-listing.tsx`):

Add expiration date field in Step 4 (Details):

```typescript
// Add state
const [expirationEnabled, setExpirationEnabled] = useState(false);
const [expirationDate, setExpirationDate] = useState(new Date());

// Add to renderStep5 (after description input):
<View style={styles.toggleContainer}>
  <Text style={styles.toggleLabel}>Set Expiration Date</Text>
  <Switch
    value={expirationEnabled}
    onValueChange={setExpirationEnabled}
    trackColor={{ false: colors.border, true: colors.primary }}
    thumbColor={colors.background}
  />
</View>

{expirationEnabled && (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Expires On</Text>
    <TouchableOpacity
      style={styles.dateButton}
      onPress={() => setShowExpirationPicker(true)}
    >
      <Text style={styles.dateButtonText}>
        {expirationDate.toLocaleDateString()}
      </Text>
    </TouchableOpacity>
    {showExpirationPicker && (
      <DateTimePicker
        value={expirationDate}
        mode="date"
        display="default"
        minimumDate={new Date()}
        onChange={(event, selectedDate) => {
          setShowExpirationPicker(Platform.OS === 'ios');
          if (selectedDate) {
            setExpirationDate(selectedDate);
          }
        }}
      />
    )}
  </View>
)}

// Update handleSubmit (line 153):
const serviceData = {
  specialist_profile_id: profile.id,
  category_id: selectedCategory,
  title: title.trim(),
  description: description.trim(),
  price: priceEnabled ? parseFloat(price) : 0,
  currency: priceEnabled ? currency : 'USD',
  city: location.trim() || null,
  is_active: true,
  expires_at: expirationEnabled ? expirationDate.toISOString() : null, // ADD THIS
};
```

**4. Display expiration warning on service detail** (`app/service/[id].tsx`):

Add after line 118:
```typescript
{service.expires_at && (
  <View style={styles.expirationWarning}>
    <IconSymbol
      ios_icon_name="clock"
      android_material_icon_name="schedule"
      size={16}
      color={colors.warning}
    />
    <Text style={styles.expirationText}>
      Expires: {new Date(service.expires_at).toLocaleDateString()}
    </Text>
  </View>
)}
```

**5. Prevent booking expired services** (`app/service/[id].tsx`):

Modify line 99:
```typescript
const isExpired = service.expires_at && new Date(service.expires_at) < new Date();
const canBook = user && profile?.role === 'consumer' && !isExpired;

// Update button (line 167):
{canBook && (
  <View style={styles.footer}>
    <TouchableOpacity style={styles.bookButton} onPress={handleBookService}>
      <Text style={styles.bookButtonText}>Book This Service</Text>
    </TouchableOpacity>
  </View>
)}

{!user && !isExpired && (
  <View style={styles.footer}>
    <TouchableOpacity style={styles.bookButton} onPress={() => router.push('/auth/login')}>
      <Text style={styles.bookButtonText}>Sign In to Book</Text>
    </TouchableOpacity>
  </View>
)}

{isExpired && (
  <View style={styles.footer}>
    <View style={styles.expiredBanner}>
      <Text style={styles.expiredText}>This service listing has expired</Text>
    </View>
  </View>
)}
```

---

## 6. Summary of Changes

### Files to Create:
1. `supabase/migrations/20260215_add_reviews.sql`
2. `supabase/migrations/20260215_add_service_expiration.sql`
3. `components/ReviewForm.tsx`
4. `components/ReviewsList.tsx`

### Files to Modify:
1. `types/database.ts` - Add Review interface, update Service interface
2. `app/(tabs)/services.tsx` - Filter expired services
3. `app/service/[id].tsx` - Display reviews, show expiration, prevent expired bookings
4. `app/order/[id].tsx` - Add review form for completed orders
5. `app/create-listing.tsx` - Add expiration date field
6. `app/booking/[serviceId].tsx` - Check expiration before allowing booking

### Database Changes:
1. Create `reviews` table with RLS policies
2. Create trigger to auto-update service ratings
3. Add `expires_at` column to `services` table

### RLS Rules:
- ✅ Only consumers who completed an order can review
- ✅ One review per order (UNIQUE constraint)
- ✅ Consumers can update their own reviews
- ✅ Everyone can view reviews

---

## 7. Testing Checklist

### Reviews:
- [ ] Consumer can submit review after order is marked "done"
- [ ] Consumer cannot review before order is done
- [ ] Consumer cannot submit duplicate reviews for same order
- [ ] Consumer can update their existing review
- [ ] Service rating_avg and rating_count update automatically
- [ ] Reviews display on service detail page
- [ ] Specialist cannot review their own services

### Expiration:
- [ ] Specialist can set expiration date when creating service
- [ ] Expired services don't appear in listings
- [ ] Expired services show warning on detail page
- [ ] Expired services cannot be booked
- [ ] Services without expiration date work normally
- [ ] Expiration date can be optional

---

## 8. Migration Order

1. Run `20260215_add_reviews.sql`
2. Run `20260215_add_service_expiration.sql`
3. Create new components (ReviewForm, ReviewsList)
4. Update TypeScript types
5. Update UI components
6. Test thoroughly

---

**End of Analysis**
