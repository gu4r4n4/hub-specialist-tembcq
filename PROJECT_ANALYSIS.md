# Hub Specialist — Project Analysis & Next Steps

**Location:** `E:\FAILI\Hub-sspeacialist\1.HUB-work\hub-specialist-tembcq`

**Purpose of this document**
This file summarizes what is already implemented in the Hub Specialist codebase, what was recently fixed during debugging, what is currently working, and what remains to be done to reach a clean MVP and a production-ready baseline.

---

## 1) Product goal (current target MVP)
Hub Specialist is a **services marketplace**:
- Roles: **consumer** (books services) and **specialist** (provides services)
- Core flow: **browse → view service/specialist → book → order lifecycle**
- Order statuses (spec): `new → confirmed → in_progress → done → cancelled`

---

## 2) Tech stack (current)
- **Expo / React Native + TypeScript**
- **Expo Router** for navigation (`app/` routes)
- **Supabase** backend:
  - Auth (email/password)
  - Postgres tables + RLS
  - Optional Storage (not yet required for MVP)
- Icons:
  - iOS: SF Symbols via `expo-symbols`
  - Android/Web: MaterialIcons via `@expo/vector-icons/MaterialIcons`

---

## 3) Repo structure (high level)
Key folders:
- `app/` — routes (tabs, auth, details)
- `contexts/` — auth state management
- `lib/` — Supabase client
- `utils/` — helpers (category icon mapping, etc.)
- `types/` — TypeScript DB types
- `supabase/` + `SUPABASE_SETUP.md` — backend setup guidance

---

## 4) What’s already implemented (functional)
### 4.1 Navigation / Screens
- Tabs: **Home / Services / Orders / Profile**
- Auth: **Login / Register**
- Details: **Service**, **Specialist**, **Order**, **Booking** routes exist

### 4.2 Supabase integration
- Supabase client configured with AsyncStorage session persistence
- AuthContext:
  - session loading
  - sign up / sign in / sign out
  - profile lookup (by `profiles.user_id`)

### 4.3 Marketplace data flow (current)
- Categories + services are loaded from Supabase (when configured)
- Service listings render and link to Service Detail
- Specialist profile screen route exists (needs enrichment depending on MVP scope)

---

## 5) Recent debugging & fixes completed (high impact)
### 5.1 Category icons (missing icons fixed)
- Added/used `utils/categoryIcons.ts` mapping to provide consistent icons cross-platform
- Ensured both Home and Services use icon mapping as the primary source (DB values are fallback)

### 5.2 Services tab scrolling “dead zone” (fixed)
Problem:
- A large white area below the category row was capturing gestures.
- On iPhone this blocked vertical scrolling; only horizontal category scrolling worked.

Fix:
- Replaced horizontal categories `ScrollView` with a **fixed-height wrapper + horizontal FlatList**
- This tightly bounds the gesture region to the visible category strip.

---

## 6) Current state: what works vs what still needs work
### Working now (expected)
- App launches (assuming dependencies installed)
- Tabs render with FloatingTabBar
- Categories row scrolls horizontally without blocking vertical list scrolling (Services tab)
- Category icons display correctly for mapped categories

### Still needs attention (important)
Items below are the most likely sources of build/tooling instability and future bugs.

## 7) Critical technical debt / blockers (fix before scaling)
### 7.1 Expo config correctness
- `app.json` currently contains **spaces** in `slug` and `scheme`.
  - **Required:** set `slug` to URL-safe (e.g., `hub-specialist`)
  - **Required:** set `scheme` without spaces (e.g., `hubspecialist`)
- iOS `bundleIdentifier` and Android `package` still look like placeholders.
  - **Required for shipping:** set to your real reverse-domain IDs.

### 7.2 TypeScript config
- `tsconfig.json` contains a trailing comma in `include` (invalid JSON).
  - **Required:** remove trailing comma so tooling/CI won’t break.

### 7.3 Babel alias
- `babel.config.js` contains alias `@style: "./style"` but the folder is `styles/`.
  - **Required:** fix alias to `./styles` or remove `@style`.

### 7.4 Supabase configuration hygiene
- `app.json` includes `extra.supabaseUrl` and a placeholder key value.
- `lib/supabase.ts` currently treats “any non-empty key” as configured.
  - **Required:** treat placeholders like `YOUR_SUPABASE_ANON_KEY` as **NOT configured**.
  - **Recommended:** show Setup screen when not configured and avoid noisy auth calls.

## 8) Data model alignment (make sure DB matches MVP spec)
The repo contains Supabase setup docs (`SUPABASE_SETUP.md`) that define tables for:
- `profiles` (with `role: consumer|specialist`)
- `categories`
- `services`
- `orders` (with required statuses)

**To verify/complete:**
- Confirm Supabase DB has these exact tables/columns.
- Confirm RLS policies match the intended access:
  - categories/services are readable publicly
  - profiles: user can edit their own; public reads only safe fields
  - orders: only the consumer and assigned specialist can read/update

---

## 9) UI/UX gaps to close (MVP polish)
### 9.1 Services list card enrichment
- Under each service card, show specialist summary (avatar + name + rating).
  - Some screens already query `specialist:profiles!specialist_profile_id(*)`; ensure UI uses it consistently.

### 9.2 Specialist profile “real marketplace” view
Recommended specialist profile sections:
- Header: avatar, full name, city, bio
- Rating block: avg + count
- Services by this specialist
- (Next feature) Portfolio gallery of works

### 9.3 Empty / loading / error states
- Ensure every major fetch has:
  - loader
  - empty state
  - readable error state (no silent blank screens)

## 10) Feature backlog (recommended order)
### Stage 0 — Stability baseline (must)
1) Fix `tsconfig.json` trailing comma
2) Fix `babel.config.js` `@style` alias
3) Fix `app.json` slug/scheme (no spaces) + bundle IDs
4) Harden `isSupabaseConfigured` (ignore placeholders)

### Stage 1 — Auth & profiles (must)
1) Profile edit screen (name, city, bio, avatar)
2) Ensure role-based behavior:
   - consumer: can book and see own orders
   - specialist: can see assigned orders

### Stage 2 — Booking & order lifecycle (must)
1) Booking form creates `orders` with status `new`
2) Order detail allows status transitions based on role
3) RLS verifies the above server-side

### Stage 3 — Specialist portfolio gallery (next)
1) DB: `specialist_portfolio_images` table + RLS
2) Specialist screen: gallery display + empty state
3) Optional: upload to Supabase Storage bucket `portfolio`

---

## 11) Notes on icon system (risk & recommendation)
- iOS uses SF Symbols (string names)
- Android/Web uses MaterialIcons (string keys)
- The code supports icon names coming from mapping and/or DB.

**Recommendation:** keep a single source of truth in code (`CATEGORY_ICON_MAP`) and treat DB icon fields as optional overrides only after validating names.

## 12) How to hand off to another agent (suggested checklist)
Provide the next agent:
1) Your desired bundle IDs (iOS + Android)
2) Whether Supabase credentials will be set via:
   - Expo public env vars, or
   - `app.json -> expo.extra`
3) Confirmation that DB SQL from `SUPABASE_SETUP.md` is applied
4) A test user account for consumer + specialist

---

## 13) Quick QA checklist (current + after fixes)
- [ ] App starts (no red screen)
- [ ] Tabs navigate correctly
- [ ] Home loads categories and featured services
- [ ] Services: categories scroll horizontally; vertical services list scrolls everywhere (no dead zones)
- [ ] Service detail opens
- [ ] Specialist detail opens
- [ ] Auth: register/login/logout works
- [ ] Orders: list + detail works according to role (after Stage 2)

---

## 14) Open questions (to decide soon)
1) Final app identifiers (bundle/package IDs)
2) Currency + region defaults
3) Do we need reviews in MVP, or only after orders are stable?
4) Do we include portfolio upload in MVP or just gallery display?
