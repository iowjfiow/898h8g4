# Test plan — PR #4 (restore `/api/validate` pre-check on signup)

PR: https://github.com/iowjfiow/898h8g4/pull/4
Branch: `devin/1777820332-restore-validate-leak`
Code under test: `challenge/views/login.html` lines 260–296 (signup submit handler).

## What changed (user-visible)
PR #3 had removed the `/api/validate` call from the signup form, so typing the admin email at signup did not produce a leak. PR #4 restores the validate-then-register flow:

- On **CREATE ACCOUNT**, the form first POSTs `/api/validate { email }`.
- If validate returns **500** → form shows `An account with this email already exists.` and stops. The 500 response body still contains `debug.token` (the admin JWT) — that body is the leak surface a CTF player inspects in DevTools.
- If validate returns **200 `{available:true}`** → the form proceeds to `/api/register` and (on 200) sets the cookie + redirects to `/dashboard` with the entered name.

The two intentional CTF vulnerabilities are unchanged: `/api/validate` 500 leak, and email-only `/admin/dashboard` middleware.

## Adversarial primary flow

This single flow is designed so a broken PR #4 (e.g. signup posting straight to `/api/register` like PR #3 did, or omitting `/api/validate` entirely) produces visibly different output from a working PR #4. Every assertion is concrete.

### Setup before the flow
1. Clear cookies for `localhost:1337`.
2. Navigate to `http://localhost:1337/login`.
3. From the page console, monkey-patch `fetch` so we can observe outgoing requests without DevTools (Chrome for Testing has DevTools shortcuts disabled in this environment):
   ```
   window.__calls = [];
   const _f = window.fetch.bind(window);
   window.fetch = async (...a) => {
     const r = await _f(...a);
     try {
       const c = r.clone();
       const t = await c.text();
       window.__calls.push({ url: a[0], status: r.status, body: t });
     } catch(e){
       window.__calls.push({ url: a[0], status: r.status, body: null });
     }
     return r;
   };
   ```

### Step A — Admin email at signup MUST hit `/api/validate` and the response MUST leak the admin JWT
1. In the **CREATE AN ACCOUNT** card, enter:
   - FULL NAME: `Probe`
   - EMAIL: `mahesh@nexora.htb`
   - PASSWORD: `pwpwpwpw`
   - CONFIRM PASSWORD: `pwpwpwpw`
   - Tick **I agree to the Terms of Service**
2. Click **CREATE ACCOUNT**.
3. Wait for the inline error to render.
4. From the page console, evaluate `JSON.stringify(window.__calls)`.

**Pass criteria (ALL must hold):**
- `window.__calls` length ≥ 1 and the **first** entry has `url == "/api/validate"` and `status == 500`. *(Without this, the leak is not reachable from the UI — exactly the bug PR #4 fixes.)*
- That entry's `body` parses as JSON containing `debug.token` whose JWT payload (base64-decoded middle segment) decodes to an object with `email == "mahesh@nexora.htb"` AND `role == "admin"`.
- `window.__calls` length **==** 1 (no follow-up `/api/register` call after a 500 — the form must short-circuit).
- The on-screen error banner reads exactly `An account with this email already exists.` (no other wording).
- `document.cookie` contains no `token=` entry (no cookie was set).
- URL stays `/login`.

**Visibly different if broken:**
- If signup still posts directly to `/api/register` (PR #3 behaviour): first entry would be `/api/register`, status 409, body `{"error":"user already exists"}` — NO `debug.token` anywhere. Fails the second pass criterion immediately.
- If validate is called but the server doesn't leak (vuln removed): status would be 200/4xx without `debug.token`. Fails the second pass criterion.
- If the form doesn't short-circuit and proceeds to register after the 500: `__calls.length == 2` and the second call is `/api/register`. Fails the third pass criterion.

### Step B — Fresh email signup still works end-to-end (regression — one screenshot only)
1. Reload `/login` (`window.__calls` resets).
2. Re-apply the same `fetch` monkey-patch.
3. Fill signup with a NEW email (e.g. `probe2@example.com`), name `Probe Two`, valid password+confirm, tick Terms, click **CREATE ACCOUNT**.

**Pass criteria:**
- `window.__calls` (captured just before redirect via console) has exactly two entries in order: `[ {url:"/api/validate", status:200}, {url:"/api/register", status:200} ]`.
- The validate response body parses to `{"available":true}` (no `debug.token`, no leak for non-existent users).
- The register response body parses to JSON containing `token`, and the JWT payload decodes to `{email:"probe2@example.com", role:"user", name:"Probe Two", ...}`.
- Browser navigates to `/dashboard`.
- The greeting on `/dashboard` reads exactly `Welcome, Probe Two`.

**Visibly different if broken:**
- If validate isn't called for fresh emails either: only one call observed.
- If register stops including `name` in the JWT: the dashboard greeting would say `Welcome, ` with an empty/undefined name.

## Out of scope for this PR
The following were verified passing on PR #3 against the same container build and are not re-tested here:
- `/admin/login` always returning 401 with no token field (regression-safe)
- `/admin/dashboard` cookie auth with the leaked JWT (regression-safe)
- Mobile 390 px overflow sweep (regression-safe — login.html DOM was not changed by PR #4)

If Step A or Step B uncovers anything unexpected, I will expand the test plan.
