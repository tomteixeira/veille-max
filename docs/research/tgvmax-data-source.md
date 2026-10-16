# TGV Max / MAX JEUNE data source — facts (checked 2026-10-16)

## Open dataset `tgvmax` (SNCF Voyageurs, Opendatasoft)

- Records: `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records` (max 100 rows/call, offset+limit ≤ 10 000)
- Exports (no row cap, supports `where`): `.../catalog/datasets/tgvmax/exports/{csv|json}`
- Metadata: `.../catalog/datasets/tgvmax` (`data_processed` gives the refresh timestamp)
- No API key. `X-RateLimit-Limit: 150000`/day, apparently a pool shared by all anonymous callers. Licence ODbL.
- **Refresh: once a day, ~04:24 UTC (06:24 Paris, summer time).** Seats released or freed during the day are invisible until the next snapshot. DST shift after 2026-10-25 unverified.
- Horizon J+0 → J+30, but J+30 is captured before that day's quota is loaded: a new day is effectively visible at J+29.
- One row per (date, train, origin→destination), intermediate stops included, direct trains only. **All** trains listed; `od_happy_card` = `OUI` (a 0 € MAX JEUNE/SENIOR seat open at snapshot time) / `NON`. No seat count.
- Fields: `date`, `train_no`, `entity`, `axe`, `origine_iata`/`destination_iata` (actually 5-char SNCF station codes, e.g. FRPLY Paris Gare de Lyon, FRPBE Bercy, FRLPD Lyon Part-Dieu), `origine`/`destination` (city-level names only, e.g. "PARIS (intramuros)"), `heure_depart`/`heure_arrivee` ("HH:MM" text), `od_happy_card`.
- ~10–13k rows/day, ~380k rows total; full CSV 36 MB.
- Data quality: ~300 duplicate (date, train, route) keys per snapshot, most with conflicting OUI/NON. All OUIGO rows `NON` (unclear whether OUIGO MAX seats are simply not reflected).
- No official history. Community: [charlyppr/maxplor-tgvmax-archive](https://github.com/charlyppr/maxplor-tgvmax-archive) (daily counters since 2026-08-17) — observed release waves around J-29, J-11 and J-3 (unofficial).

### Querying efficiently

- Server-side aggregation works: `.../tgvmax/records?select=date,count(*) as n&where=od_happy_card='OUI'&group_by=date` (with `group_by`, offset+limit ≤ 20 000; grouped dates come back as `2026-10-16T00:00:00+00:00`).
- Filtered export: `.../tgvmax/exports/json?where=origine_iata in ('FRPLY') and destination_iata in ('FRLPD','FRLPE')` → only matching rows (~1 100 rows, 327 KB, 0.5 s for a 30-day horizon).
- Note: no Paris Bercy → Lyon train exists in the dataset.

## Station names

- No SNCF dataset maps the 5-char codes. `gares-de-voyageurs.libellecourt` looks similar but is a different code (Part-Dieu = LYD, not LPD) — don't use it.
- [trainline-eu/stations](https://github.com/trainline-eu/stations) `stations.csv` (ODbL): `sncf_id` = the 5-char code, plus `name`, `uic8_sncf`, lat/lon. Matches 317/322 dataset codes (misses: 5 Meuse coach stops).
- Only 10 codes have city-level names in `tgvmax` (FRPLY, FRPBE, FRPMO, FRPNO, FRPST, FRPAZ, FRLPD, FRLPE, FRLLE, FRADJ); the rest are already station-level.

## SNCF Connect deep link (verified in a browser 2026-10-16)

`https://www.sncf-connect.com/fr-FR/redirect?redirection_type=SEARCH&origin_transporter_code=FRPLY&destination_transporter_code=FRLPD&outward_date=2026-10-23-07-00`

- Takes the dataset's 5-char codes directly; `outward_date` = `YYYY-MM-DD-HH-mm`.
- Opens the outward results page pre-filled ("Paris Gare de Lyon - Lyon Part-Dieu, vendredi 23 octobre, à partir de 7:00"). Claimed by the iOS app's universal links (`/redirect`), so it opens the app when installed.
- No parameter for the MAX JEUNE card found; prices shown are for an anonymous passenger (presumably the logged-in profile applies the card — unverified). Undocumented format, may break.
- The MAX JEUNE site has no public pre-filled search URL.

## MAX JEUNE confirmation page

`https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages` — confirmed by the user (logged in, iPhone Safari) to open the trip confirmation page directly. Logged out, it redirects to the MAX JEUNE home page.

## Unofficial real-time sources

- `maxjeune-tgvinoui.sncf/api/public/refdata/search-freeplaces-proposals` (used by MaxPing, tgvmaxlive) and SNCF Connect BFF: all behind DataDome (403 on plain requests).
- SNCF Connect CGV (15 Sept 2026) art. 2 & 16.1 forbid robots/scripts/scraping of availability; sanctions include cancelling orders and invalidating tickets.

## MAX JEUNE rules (sncf-connect.com/aide/max-jeune)

- Booking opens D-30, 2nd class only. Max 6 trips held at once. One booking per day from the same departure city.
- Each trip must be confirmed in the MAX account before 17:00 the day before, otherwise auto-cancelled.
- 0 € tickets cannot be exchanged, only cancelled (free, until departure).
- Some peak trains (Friday/Sunday afternoons and evenings, holidays) are excluded from MAX.
- SNCF states seats are added day by day between D-30 and D-2, and seats given back by subscribers return to the quota.

## Scheduling (free tiers, 2026)

- Vercel Hobby cron: once a day, ±59 min jitter. Hobby functions (Fluid compute): 300 s max, 2 GB, 4.5 MB bodies. Nuxt deploys with the `vercel` Nitro preset, zero config.
- Supabase Cron (pg_cron, + pg_net for HTTP): down to every second. `net.http_post(url, body, params, headers, timeout_milliseconds default 2000)`, secret header from Vault. Free: 500 MB DB (read-only beyond), paused after 1 week of inactivity.
- GitHub Actions `schedule`: ≥5 min, delays of several hours observed.
- Netlify scheduled functions: 1 min, 30 s max run. Cloudflare Workers cron: 1 min, 10 ms CPU.

## Auth in an iOS Home Screen web app

- Magic links open from Mail into Safari, whose storage is separate from the installed PWA → don't use them. Email OTP (`verifyOtp({ email, token, type: 'email' })`) stays inside the app.
- Out-of-scope navigations in a standalone PWA open in an in-app browser sheet that shares storage with the PWA (not with Safari); a redirect back to an in-scope URL returns to the standalone window ([firt.dev](https://firt.dev/notes/pwa-ios/)). So Supabase PKCE + full-page redirect + in-scope `redirectTo` should work — no 2024-2026 primary source confirms it end to end; test on a real device. Avoid popups.
- Sign in with Apple (web): needs the paid Apple Developer Program (99 USD/yr) for the App ID + Services ID, and the client secret must be regenerated every 6 months.
- Google OAuth: free, no verification for basic scopes; consent screen shows `<project>.supabase.co` unless a (paid) custom domain is set. Clients unused for 6 months are auto-deleted.

## Web Push on iOS

- iOS 16.4+, only for web apps added to the Home Screen (`display: standalone`). Permission must be requested from a user gesture. No silent push. VAPID, payload ≤ 4 KB.
- `clients.openWindow()` with an out-of-scope URL: behaviour on iOS undocumented (probably the in-app sheet, i.e. not the user's logged-in Safari). In-scope `openWindow` was buggy on iOS 16/17 (opened the root), works on iOS 26 per WebKit bug 263687. Declarative Web Push (iOS 18.4+) `navigate` skips the `notificationclick` handler.
- `@vite-pwa/nuxt` 1.1.1 works on Nuxt 4 per users (no official statement); open bug with manifest 404 on the node-server preset ([#228](https://github.com/vite-pwa/nuxt/issues/228)). Custom push handlers via `strategies: 'injectManifest'`.
