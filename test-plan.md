# Test plan — PR #3 (signup flow + admin auth + mobile)

Live URL: `https://user:3d5449f8972c0b5d8496ed58f0bcc43c@f0ac3dc99958-tunnel-5grnjt4l.devinapps.com`

## What changed (user-visible)
- Signup posts directly to `/api/register`. The previous `/api/validate` pre-check is gone, so typing the admin email at signup no longer leaks the admin JWT.
- Login + signup forms tolerate non-JSON server responses and show explicit "Could not reach the server" or HTTP-status messages instead of "Network error".
- `package.json` and the boot log line no longer say `TargetShop`.
- Headers, hero, dashboard cards, newsletter strip and orders table now scale down for narrow viewports (`/`, `/login`, `/admin`, `/about`, `/dashboard`, `/admin/dashboard`).

The two intentional CTF vulnerabilities are unchanged: `/api/validate` still leaks a JWT in a 500 when the email exists; `/admin/dashboard` is gated solely on `payload.email === "mahesh@nexora.htb"`.

## Primary flow

Each step has a concrete pass/fail criterion. A broken implementation produces visibly different output for at least one assertion in every step.

### 1. Signup with a fresh email — no `/api/validate` call, lands on dashboard with the entered name
- Open DevTools → Network and clear the log.
- On `/login`, fill the **CREATE AN ACCOUNT** card with `Vinod Kumar` / `vinod_test@example.com` / `hunter2hunter2` / `hunter2hunter2`, tick Terms, click **CREATE ACCOUNT**.
- **Expected**:
  - Network panel shows exactly one `POST /api/register` returning **200**. **No** `POST /api/validate` request.
  - Browser navigates to `/dashboard`.
  - The greeting reads `Welcome, Vinod Kumar` (not "Welcome, there" and not "Archer").
  - Profile card "DISPLAY NAME" input value is `Vinod Kumar`; "EMAIL" input value is `vinod_test@example.com`.
- **Fails if**: a `/api/validate` request is observed, the greeting reads "Archer" or "there", or the dashboard shows a hard-coded email.

### 2. Signup with the admin email — 409 with no token leak
- Log out, return to `/login`.
- Open DevTools → Network, clear log.
- Fill signup with `Admin` / `mahesh@nexora.htb` / `pwpwpwpw` / `pwpwpwpw`, tick Terms, click **CREATE ACCOUNT**.
- **Expected**:
  - One `POST /api/register` request, status **409**, response body `{"error":"user already exists"}`. No `token` field anywhere in the response.
  - On-screen error reads `An account with this email already exists.`
  - URL stays `/login`, no cookie named `token` is set.
- **Fails if**: response body contains a `token` key, the cookie store gets a `token` after this submission, or the page redirects to `/dashboard`.

### 3. Login with bad credentials — clean error (not "Network error")
- On `/login`, in the LOGIN card enter `vinod_test@example.com` / `wrong-password` and click **LOG IN**.
- **Expected**: Inline message reads exactly `invalid credentials` (server's wording). The literal string `Network error` MUST NOT appear.
- **Fails if**: the page shows the legacy "Network error" banner.

### 4. Intended CTF solve still works — admin JWT cookie unlocks `/admin/dashboard`
- Open a fresh tab. From a terminal already in the session: `curl -s -u user:<basic> -X POST <tunnel>/api/validate -H 'Content-Type: application/json' -d '{"email":"mahesh@nexora.htb"}'` and copy `debug.token`.
- Decode the JWT body and verify `email == "mahesh@nexora.htb"`, `role == "admin"`. (The token must be issued under today's middleware key, not the legacy `mahesh@targetshop.htb` value.)
- In the browser, on the tunnel origin, open DevTools → Application → Cookies → add a cookie `token` with that JWT value, path `/`.
- Navigate to `/admin/dashboard`.
- **Expected**: page loads with HTTP **200**, "Operations dashboard" heading visible. View Source → footer contains the literal HTML comment `<!-- HTB{final_flag_not_decided} -->`.
- **Fails if**: response is 401, or the footer comment is missing.

### 5. `/admin` decoy never leaks a JWT
- On `/admin`, enter `mahesh@nexora.htb` / `9b8f2c1e7a4d6b3f8e0a1c5d2b7e9f4a` and click **LOGIN**.
- **Expected**: red banner reads `Invalid Credentials`. Network response status **401**, body `{"error":"Invalid Credentials"}` — no `token` field.
- **Fails if**: response contains a token, or status is anything other than 401.

### 6. Mobile responsiveness (≤ ~390 px viewport)
- Open Chrome DevTools → toggle device toolbar → set viewport to 390 × 800 (iPhone 12 size).
- Visit `/`, `/login`, `/admin`, `/about`, `/dashboard`, `/admin/dashboard`.
- **Expected for every page**:
  - No horizontal scrollbar at 390 px wide.
  - The brand wordmark, account icon and cart icon all fit on the same row in the header.
  - On `/`: hero text "Simplicity. / Redefined." is readable and the vase art does not overflow horizontally.
  - On `/login`: the LOGIN and CREATE AN ACCOUNT cards stack vertically; both forms are fully visible without horizontal scroll.
  - On `/dashboard`: the three KPI cards (ORDERS / WISHLIST / REWARDS) fit on one row at 3 cols.
  - On `/admin/dashboard`: stat cards stack to 2 cols; the orders table is horizontally scrollable inside its panel rather than overflowing the viewport.
- **Fails if**: any page produces a horizontal scrollbar at 390 px or visibly clips text/inputs.

## Evidence to capture
- Recording covering steps 1–6 in one continuous take.
- Screenshots of: dashboard greeting (step 1), 409 banner + lack of token in network response (step 2), login error banner (step 3), `/admin/dashboard` rendered + flag in source (step 4), `/admin` 401 banner (step 5), the 6 mobile pages (step 6).
- Curl outputs from earlier smoke run as supporting text evidence.
