# STICKER RUSH

A Next.js + Supabase starter for a shared sticker-spin game.

## Included
- Username + password registration/login (username is mapped to an internal, non-deliverable alias email).
- Shared player collection and leaderboard.
- Server-side atomic spin RPC and pity counter.
- Milestone boost: spins 10/20/30/40 have 10% legendary chance; other non-guaranteed spins have 1%; spin 50 is guaranteed.
- Legendary resets the pity counter.
- Protected admin route for sticker uploads, rarity assignment, catalog listing and deletion.
- Public leaderboard refreshes via realtime plus periodic refresh.

## Setup

1. Create a project at https://supabase.com.
2. In Supabase, open **SQL Editor**, paste and run `supabase/schema.sql`.
3. In **Authentication > Providers > Email**, disable email confirmations. This starter uses username-only sign-in by mapping usernames to an internal alias email; it does not collect real email addresses. Do not use this pattern if you later need email recovery or verification.
4. Copy `.env.example` to `.env.local` and add your Supabase Project URL and anon/public key.
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
6. Open http://localhost:3000 and create your player account.
7. In Supabase SQL Editor, promote your account:
   ```sql
   update public.profiles set role='admin' where username='YOUR_USERNAME';
   ```
8. Log out and back in, then open **ADMIN PANEL** to upload stickers.

## Important deployment/security notes
- Never put a Supabase service-role key in the browser or commit it to Git.
- Use a strong unique password. Username-only login means there is no built-in email password reset; add a verified recovery method before a public launch.
- Configure Supabase Auth rate limits and CAPTCHA/Turnstile before opening public registration.
- The database spin function locks the player's profile row, so simultaneous spin requests cannot bypass pity progression.
- The milestone boost redistributes the remaining 90% as 60% Rare / 30% Epic. Normal spins redistribute 99% as 66% Rare / 33% Epic.
- For production, add moderation/reporting, abuse monitoring, backups and a privacy notice. Do not collect unnecessary personal data.
- The admin role is assigned directly in SQL; normal users cannot promote themselves.
