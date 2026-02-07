
# Supabase Configuration Guide

## ✅ Supabase Integration Status

Your Hub Specialist app is **fully integrated** with Supabase! All the code is in place and ready to use. You just need to add your Supabase project credentials.

## 📋 What's Already Set Up

✅ Supabase client configured (`lib/supabase.ts`)
✅ Authentication context (`contexts/AuthContext.tsx`)
✅ Database types (`types/database.ts`)
✅ All screens connected to Supabase
✅ Row Level Security (RLS) policies ready
✅ URL polyfill for React Native

## 🚀 Quick Start (3 Steps)

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Project name**: Hub Specialist
   - **Database password**: (choose a strong password)
   - **Region**: (choose closest to your users)
5. Click "Create new project"
6. Wait 2-3 minutes for provisioning

### Step 2: Get Your Credentials

1. In your Supabase project dashboard, click the **Settings** icon (⚙️) in the sidebar
2. Go to **API** section
3. You'll see:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

### Step 3: Add Credentials to Your App

Open `app.json` and replace the placeholder values:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://xxxxxxxxxxxxx.supabase.co",
      "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**Important**: After updating `app.json`, restart your Expo dev server:
```bash
# Press Ctrl+C to stop the server
# Then restart:
npm run dev
```

## 🗄️ Database Setup

After adding your credentials, you need to create the database tables. Follow the complete SQL setup in `SUPABASE_SETUP.md`:

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (in the sidebar)
3. Click **New Query**
4. Copy the SQL from `SUPABASE_SETUP.md` section "2. Complete SQL Setup"
5. Run each section in order:
   - Step 1: Create Tables
   - Step 2: Create Indexes
   - Step 3: Row Level Security (RLS) Policies
   - Step 4: Seed Data (optional test data)

## 🧪 Testing Your Setup

After completing the steps above:

1. **Restart your app**: Stop and restart the Expo dev server
2. **Check the home screen**: You should see categories and services (if you added seed data)
3. **Try registering**: Create a new account as a consumer or specialist
4. **Test login**: Sign in with your new account

## 🔍 Troubleshooting

### "Supabase Not Configured" Message

**Problem**: The home screen shows a setup guide instead of content.

**Solution**: 
- Verify you added the correct `supabaseUrl` and `supabaseAnonKey` to `app.json`
- Make sure you restarted the Expo dev server after editing `app.json`
- Check that the values don't have extra spaces or quotes

### Can't See Any Services

**Problem**: The app loads but no services appear.

**Solution**:
- Make sure you ran the SQL scripts in Supabase (especially Step 4: Seed Data)
- Check the Supabase dashboard → Table Editor → verify `categories` and `services` tables have data
- Check the console logs for any error messages

### Authentication Errors

**Problem**: Can't register or login.

**Solution**:
- Verify the `profiles` table was created (Step 1 of SQL setup)
- Check that RLS policies were applied (Step 3 of SQL setup)
- In Supabase dashboard → Authentication → Settings, make sure "Enable email confirmations" is **disabled** for testing

### RLS Policy Errors

**Problem**: Getting "permission denied" or "row level security" errors.

**Solution**:
- Make sure you ran Step 3 (RLS Policies) from the SQL setup
- Verify your user has a profile in the `profiles` table
- Check the Supabase dashboard → Authentication → Users to see if your user exists

## 📚 Additional Resources

- **Full Setup Guide**: See `SUPABASE_SETUP.md` for complete architecture, SQL scripts, and QA checklist
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Expo Docs**: [docs.expo.dev](https://docs.expo.dev)

## 🎯 Next Steps

Once your app is working:

1. **Customize the seed data**: Add your own categories and services
2. **Test the full flow**: Register → Browse → Book → Manage orders
3. **Add features**: See "Next Steps" section in `SUPABASE_SETUP.md` for ideas (reviews, chat, subscriptions)
4. **Deploy**: Use `eas build` to create production builds for iOS and Android

## 💡 Pro Tips

- **Development**: Use the seed data to test without creating real services
- **Production**: Remove seed data and let real users create content
- **Security**: Never commit your `supabaseAnonKey` to public repositories
- **Backups**: Supabase automatically backs up your database daily

---

**Need Help?** Check the console logs in your Expo dev tools for detailed error messages.
