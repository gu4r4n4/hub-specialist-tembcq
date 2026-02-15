# Database Migrations

This folder contains SQL migration files for the Supabase database.

## How to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of the migration file
4. Paste and run the SQL

### Option 2: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push
```

## Migration Files

- `20260215_add_city_to_services.sql` - Adds `city` column to `services` table to store service location

## Notes

- Always backup your database before running migrations
- Test migrations in a development environment first
- Migration files are named with timestamp prefix for ordering
