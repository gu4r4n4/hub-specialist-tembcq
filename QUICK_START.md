
# 🚀 Quick Start Guide - Hub Specialist

Your Hub Specialist marketplace app is **fully integrated with Supabase** and ready to use! Just follow these 3 simple steps:

## ✅ What's Already Done

- ✅ Supabase client configured
- ✅ Authentication system ready
- ✅ All database types defined
- ✅ All screens connected to Supabase
- ✅ Row Level Security (RLS) policies prepared
- ✅ Complete SQL setup scripts ready

## 📝 3 Steps to Get Started

### Step 1: Create Your Supabase Project (5 minutes)

1. Go to **[supabase.com](https://supabase.com)** and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: Hub Specialist
   - **Database Password**: (choose a strong password - save it!)
   - **Region**: (choose closest to you)
4. Click **"Create new project"**
5. Wait 2-3 minutes for setup to complete

### Step 2: Add Your Credentials (1 minute)

1. In your Supabase dashboard, click **Settings** (⚙️) → **API**
2. Copy these two values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (long string)
3. Open `app.json` in your project
4. Replace the placeholder values:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "PASTE_YOUR_PROJECT_URL_HERE",
      "supabaseAnonKey": "PASTE_YOUR_ANON_KEY_HERE"
    }
  }
}
```

5. **Restart your Expo dev server**:
   - Press `Ctrl+C` to stop
   - Run `npm run dev` again

### Step 3: Set Up Your Database (5 minutes)

1. In Supabase dashboard, go to **SQL Editor** (in sidebar)
2. Click **"New Query"**
3. Open `SUPABASE_SETUP.md` in your project
4. Copy and run each SQL section in order:
   - **Step 1**: Create Tables
   - **Step 2**: Create Indexes
   - **Step 3**: Row Level Security Policies
   - **Step 4**: Seed Data (optional - adds test data)

**That's it!** Your app is now fully functional! 🎉

## 🧪 Test Your App

1. **Register**: Create a new account (choose Consumer or Specialist role)
2. **Browse**: View categories and services on the home screen
3. **Book**: Click a service and create a booking
4. **Manage**: View and update orders in the Orders tab

## 📱 App Features

### For Consumers:
- Browse services by category
- Search and filter services
- View specialist profiles
- Book appointments
- Track order status
- Cancel orders (when status is "new" or "confirmed")

### For Specialists:
- Create and manage services
- Receive booking requests
- Update order status (confirm → in progress → done)
- View earnings and completed jobs

## 🔧 Troubleshooting

### "Supabase Not Configured" message?
- Check that you added the correct URL and key to `app.json`
- Make sure you restarted the Expo dev server
- Verify no extra spaces or quotes in the values

### No services showing?
- Make sure you ran Step 4 (Seed Data) from the SQL setup
- Check Supabase dashboard → Table Editor → verify data exists

### Can't register/login?
- Verify you ran all SQL steps (especially Step 3: RLS Policies)
- In Supabase → Authentication → Settings, disable "Enable email confirmations" for testing

## 📚 Next Steps

Once everything is working:

1. **Customize**: Add your own categories and services
2. **Extend**: Add reviews, chat, or subscriptions (see `SUPABASE_SETUP.md`)
3. **Deploy**: Use `eas build` to create production apps

## 📖 Documentation

- **Full Setup**: `SUPABASE_SETUP.md` - Complete architecture and SQL
- **Configuration**: `SUPABASE_CONFIGURATION.md` - Detailed setup guide
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)

---

**Need help?** Check the console logs in your Expo dev tools for detailed error messages.
