
# HUB SPECIALIST - Supabase Setup Guide

## 1. Architecture Overview

### Folder Structure
```
app/
├── (tabs)/              # Main tab navigation
│   ├── (home)/         # Home screen with categories & featured services
│   ├── services.tsx    # Services catalog with search & filters
│   ├── orders.tsx      # Orders list (role-based)
│   └── profile.tsx     # User profile & settings
├── auth/               # Authentication screens
│   ├── login.tsx       # Email/password login
│   └── register.tsx    # Registration with role selection
├── service/[id].tsx    # Service detail page
├── specialist/[id].tsx # Specialist profile page
├── booking/[serviceId].tsx # Booking form
└── order/[id].tsx      # Order detail with status actions

contexts/
└── AuthContext.tsx     # Supabase auth state management

lib/
└── supabase.ts         # Supabase client configuration

types/
└── database.ts         # TypeScript interfaces for database tables
```

### Navigation Map
- **Home Tab**: Browse categories → View featured services → Service detail → Book service
- **Services Tab**: Search/filter services → Service detail → Specialist profile → Book service
- **Orders Tab**: View orders (consumer: bookings, specialist: jobs) → Order detail → Update status
- **Profile Tab**: View profile → Sign out (or Sign in/Register if not authenticated)

### Data Layer Approach
- **Supabase Client**: Configured with AsyncStorage for session persistence
- **Auth Context**: Manages authentication state and profile data
- **Direct Supabase Queries**: Components query Supabase directly (no API layer)
- **RLS Enforcement**: All data access controlled by Row Level Security policies

### Auth & Profile Lookup Strategy
1. User signs up → Supabase Auth creates user in `auth.users`
2. Profile row created in `profiles` table with `user_id` reference
3. AuthContext fetches profile on login and stores in React Context
4. Profile includes role (consumer/specialist) for UI/permission logic

---

## 2. Complete SQL Setup

### Step 1: Create Tables

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('consumer', 'specialist')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  city TEXT,
  bio TEXT,
  category_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  specialist_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  specialist_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('new', 'confirmed', 'in_progress', 'done', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  address TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Step 2: Create Indexes

```sql
-- Profiles indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_category_id ON profiles(category_id);

-- Services indexes
CREATE INDEX idx_services_specialist_profile_id ON services(specialist_profile_id);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_rating_avg ON services(rating_avg DESC);

-- Orders indexes
CREATE INDEX idx_orders_consumer_profile_id ON orders(consumer_profile_id);
CREATE INDEX idx_orders_specialist_profile_id ON orders(specialist_profile_id);
CREATE INDEX idx_orders_service_id ON orders(service_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

### Step 3: Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Users can view all profiles (for specialist discovery)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CATEGORIES POLICIES
-- Everyone can view categories
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  USING (true);

-- SERVICES POLICIES
-- Everyone can view active services
CREATE POLICY "Active services are viewable by everyone"
  ON services FOR SELECT
  USING (is_active = true);

-- Specialists can insert their own services
CREATE POLICY "Specialists can insert their own services"
  ON services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = specialist_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'specialist'
    )
  );

-- Specialists can update their own services
CREATE POLICY "Specialists can update their own services"
  ON services FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = specialist_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'specialist'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = specialist_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'specialist'
    )
  );

-- ORDERS POLICIES
-- Consumers can view their own orders
CREATE POLICY "Consumers can view their own orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = consumer_profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Specialists can view orders assigned to them
CREATE POLICY "Specialists can view their assigned orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = specialist_profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Consumers can create orders
CREATE POLICY "Consumers can create orders"
  ON orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = consumer_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'consumer'
    )
  );

-- Specialists can update status of their assigned orders
CREATE POLICY "Specialists can update their assigned orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = specialist_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'specialist'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = specialist_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'specialist'
    )
  );

-- Consumers can cancel their own orders (only when status is 'new' or 'confirmed')
CREATE POLICY "Consumers can cancel their own orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = consumer_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'consumer'
    )
    AND status IN ('new', 'confirmed')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = consumer_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'consumer'
    )
    AND status = 'cancelled'
  );
```

### Step 4: Seed Data

```sql
-- Insert categories
INSERT INTO categories (name) VALUES
  ('Home Cleaning'),
  ('Plumbing'),
  ('Electrical'),
  ('Carpentry'),
  ('Painting'),
  ('Gardening'),
  ('Moving & Delivery'),
  ('Tutoring'),
  ('Personal Training'),
  ('Photography');

-- Create test users (you'll need to create these via Supabase Auth UI or API)
-- For this example, assume we have:
-- User 1: specialist1@example.com (UUID: replace-with-actual-uuid-1)
-- User 2: specialist2@example.com (UUID: replace-with-actual-uuid-2)
-- User 3: consumer1@example.com (UUID: replace-with-actual-uuid-3)

-- Insert specialist profiles (replace UUIDs with actual auth.users IDs)
INSERT INTO profiles (user_id, role, full_name, city, bio, category_id) VALUES
  ('replace-with-actual-uuid-1', 'specialist', 'John Smith', 'New York', 'Professional plumber with 10 years of experience', (SELECT id FROM categories WHERE name = 'Plumbing')),
  ('replace-with-actual-uuid-2', 'specialist', 'Sarah Johnson', 'Los Angeles', 'Certified electrician specializing in residential work', (SELECT id FROM categories WHERE name = 'Electrical'));

-- Insert consumer profile
INSERT INTO profiles (user_id, role, full_name, city) VALUES
  ('replace-with-actual-uuid-3', 'consumer', 'Mike Davis', 'Chicago');

-- Insert services (replace profile IDs with actual specialist profile IDs)
INSERT INTO services (specialist_profile_id, category_id, title, description, price, currency, rating_avg, rating_count) VALUES
  (
    (SELECT id FROM profiles WHERE full_name = 'John Smith'),
    (SELECT id FROM categories WHERE name = 'Plumbing'),
    'Emergency Plumbing Repair',
    'Fast and reliable plumbing repair service. Available 24/7 for emergencies. Licensed and insured.',
    150.00,
    'USD',
    4.8,
    24
  ),
  (
    (SELECT id FROM profiles WHERE full_name = 'John Smith'),
    (SELECT id FROM categories WHERE name = 'Plumbing'),
    'Bathroom Renovation',
    'Complete bathroom renovation including fixtures, pipes, and drainage. Quality workmanship guaranteed.',
    2500.00,
    'USD',
    4.9,
    12
  ),
  (
    (SELECT id FROM profiles WHERE full_name = 'Sarah Johnson'),
    (SELECT id FROM categories WHERE name = 'Electrical'),
    'Home Electrical Inspection',
    'Comprehensive electrical safety inspection for your home. Identify potential hazards and code violations.',
    200.00,
    'USD',
    5.0,
    18
  ),
  (
    (SELECT id FROM profiles WHERE full_name = 'Sarah Johnson'),
    (SELECT id FROM categories WHERE name = 'Electrical'),
    'Lighting Installation',
    'Professional installation of indoor and outdoor lighting. Modern LED solutions available.',
    120.00,
    'USD',
    4.7,
    31
  );
```

---

## 3. Setup Steps

### A. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be provisioned
4. Note your project URL and anon key

### B. Run SQL Scripts
1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste the SQL from Step 1 (Create Tables)
3. Run the query
4. Repeat for Step 2 (Indexes), Step 3 (RLS Policies), and Step 4 (Seed Data)

### C. Create Test Users
1. Go to Authentication → Users in Supabase Dashboard
2. Click "Add User" → "Create new user"
3. Create three users:
   - specialist1@example.com (password: test123456)
   - specialist2@example.com (password: test123456)
   - consumer1@example.com (password: test123456)
4. Copy the UUIDs of these users
5. Update the seed data SQL with the actual UUIDs
6. Run the updated seed data SQL

### D. Configure Environment Variables
Create a `.env` file in your project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Or add to `app.json`:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://your-project.supabase.co",
      "supabaseAnonKey": "your-anon-key-here"
    }
  }
}
```

### E. Run the Expo App
```bash
npm install
npm run dev
```

---

## 4. Manual QA Checklist

### Stage 0: Stability
- [ ] App builds without errors on iOS, Android, and Web
- [ ] No console errors on app launch
- [ ] Tab navigation works smoothly
- [ ] All screens render without crashes

### Stage 1: Authentication & Profiles
- [ ] Register as consumer with email/password
- [ ] Register as specialist with email/password
- [ ] Login with existing credentials
- [ ] Logout successfully
- [ ] Profile data persists after app restart
- [ ] Profile screen shows correct user info and role

### Stage 2: Catalog
- [ ] Home screen displays categories
- [ ] Home screen displays featured services
- [ ] Tapping category filters services
- [ ] Services screen shows all services
- [ ] Search functionality works
- [ ] Category filter works
- [ ] Service detail screen shows complete info
- [ ] Specialist profile link works
- [ ] Loading states display correctly
- [ ] Empty states display when no data

### Stage 3: Orders (Consumer Flow)
- [ ] Consumer can book a service
- [ ] Booking form validates required fields
- [ ] Date/time picker works
- [ ] Order is created with status "new"
- [ ] Order appears in Orders tab
- [ ] Order detail shows all information
- [ ] Consumer can cancel order when status is "new" or "confirmed"
- [ ] Consumer cannot cancel order when status is "in_progress" or "done"

### Stage 3: Orders (Specialist Flow)
- [ ] Specialist sees assigned orders in Orders tab
- [ ] Specialist can confirm order (new → confirmed)
- [ ] Specialist can start work (confirmed → in_progress)
- [ ] Specialist can complete order (in_progress → done)
- [ ] Specialist can cancel order
- [ ] Status updates reflect immediately
- [ ] Specialist cannot modify consumer's orders

### RLS Verification
- [ ] Consumers cannot see other consumers' orders
- [ ] Specialists cannot see other specialists' orders
- [ ] Users cannot update profiles they don't own
- [ ] Specialists cannot modify services they don't own
- [ ] Inactive services are not visible

---

## 5. Next Steps & Extension Points

### Reviews System
- **Table**: `reviews` (id, order_id, rating, comment, created_at)
- **RLS**: Only consumer of completed order can create review
- **UI**: Add review form on completed order detail screen
- **Logic**: Update service rating_avg and rating_count on new review

### Chat/Messaging
- **Table**: `messages` (id, order_id, sender_profile_id, content, created_at)
- **RLS**: Only consumer and specialist of order can view/send messages
- **UI**: Add chat button on order detail screen
- **Real-time**: Use Supabase Realtime for live message updates

### Subscription/Premium Features
- **Table**: `subscriptions` (id, profile_id, plan, status, expires_at)
- **Logic**: Specialists pay for premium listing, featured placement
- **UI**: Add subscription management in profile screen
- **Payment**: Integrate Stripe or similar payment provider

### Service Availability Calendar
- **Table**: `availability` (id, specialist_profile_id, day_of_week, start_time, end_time)
- **UI**: Booking form shows only available time slots
- **Logic**: Prevent double-booking

### Photo Uploads
- **Storage**: Use Supabase Storage for service photos and profile avatars
- **Table**: Add `photos` array column to services table
- **UI**: Image picker in service creation/edit form

### Notifications
- **Push**: Use Expo Notifications for order status updates
- **Email**: Use Supabase Edge Functions to send email notifications
- **In-app**: Add notifications table and badge counter

### Analytics Dashboard
- **Specialist**: Total earnings, completed jobs, average rating
- **Consumer**: Total bookings, spending history
- **UI**: Add dashboard tab for specialists

---

## 6. Troubleshooting

### "Supabase Not Configured" Error
- Verify environment variables are set correctly
- Check that `EXPO_PUBLIC_` prefix is used
- Restart Expo dev server after changing env vars

### RLS Policy Errors
- Check that user is authenticated (session exists)
- Verify profile exists for authenticated user
- Check that profile role matches expected role for action
- Use Supabase Dashboard → SQL Editor to test queries manually

### Profile Not Loading
- Ensure profile was created during signup
- Check AuthContext is properly wrapping the app
- Verify `user_id` in profiles table matches `auth.users.id`

### Orders Not Appearing
- Check RLS policies allow user to view orders
- Verify order was created with correct profile IDs
- Check that profile role matches expected role (consumer/specialist)

---

## Summary

This HUB SPECIALIST marketplace is a complete MVP with:
- ✅ Supabase authentication (email/password)
- ✅ Role-based access (consumer/specialist)
- ✅ Service catalog with search and filters
- ✅ Booking system with order management
- ✅ Order status workflow (new → confirmed → in_progress → done → cancelled)
- ✅ Row Level Security enforcing data access rules
- ✅ Clean, professional UI with proper loading/error states
- ✅ Cross-platform support (iOS, Android, Web)

The architecture is designed for easy extension with reviews, chat, subscriptions, and more advanced features.
