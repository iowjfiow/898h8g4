# Test plan — PR #5 (header account icon routes to /dashboard when logged in)

PR: https://github.com/iowjfiow/898h8g4/pull/5
Branch: `devin/1777823606-account-icon-routing`
Code under test: <ref_snippet file="/home/ubuntu/targetshop_challenge/challenge/views/index.html" lines="66-77" />, same pattern in `about_us.html` (39–50) and `login.html` (59–70).

## What changed (user-visible)
The human/account icon in the site header used to be a static `<a href="/login">`. Now an inline script after the icon flips the `href` to `/dashboard` if a `token` cookie is present, otherwise leaves it as `/login`.

## Adversarial primary flow

A working PR #5 must produce **different** click destinations for the icon depending on whether the user is logged in. A broken PR #5 (script missing, condition wrong, wrong href, only some pages updated) will either land on `/login` regardless or land on `/dashboard` regardless. The plan exercises both states on the same page so the difference is visible in one continuous flow.

### Step A — Logged out, icon goes to `/login`
1. Cookies cleared; navigate to `http://localhost:1337/`.
2. Click the human/account icon in the header (top-right, between search and cart).

**Pass criteria:**
- Browser address bar shows `http://localhost:1337/login` (exact path `/login`).
- The login page renders (heading "WELCOME BACK" present in DOM).

**Visibly different if broken:**
- If the script accidentally always sets `href="/dashboard"`: lands on `/dashboard`, which (without a cookie) would render the dashboard with empty `Welcome, ` and no JWT to read — clearly wrong for a logged-out user.

### Step B — Log in, then icon on `/` goes to `/dashboard`
1. From `/login`, sign up with a fresh email (e.g. `iconprobe@example.com`, name `Icon Probe`, password `pwpwpwpw`, ticked T&C). On 200 the form sets a `token` cookie and redirects to `/dashboard`. Confirm `Welcome, Icon Probe` is on screen (this is just the precondition that we're now logged in).
2. Manually navigate the address bar to `http://localhost:1337/` (homepage with the icon).
3. Click the human/account icon in the header.

**Pass criteria:**
- Browser address bar shows `http://localhost:1337/dashboard` (exact path `/dashboard`).
- The dashboard page renders with greeting `Welcome, Icon Probe` (proves it's the same logged-in session).
- Before clicking, inspecting the icon's `href` attribute (via the page DOM dump or `document.getElementById("account-icon").getAttribute("href")` in the console) returns `/dashboard`, NOT `/login`.

**Visibly different if broken:**
- If the inline script never runs (e.g. typo, syntax error, missing): the `href` stays `/login` even with the cookie present, and clicking lands on `/login` instead of `/dashboard`.
- If the cookie check is wrong (e.g. checks for `tokens=` or wrong API): same result as above.
- If the script changes the wrong element: again, click sends user to `/login`.

## Out of scope / not retested
PR #5 only adds an `id` attribute and an inline script next to the existing icon `<a>` on three pages. It does not touch `server.js`, the `/api/validate` leak, or the admin auth. These were verified passing on PR #4 against the same container and are not retested:

- `/api/validate` 500 with `debug.token` for the admin email
- `/admin/dashboard` cookie auth using the leaked admin JWT
- `/admin/login` always returning 401
- Mobile 390 px overflow sweep

If Steps A or B uncover anything unexpected I will expand the plan.
