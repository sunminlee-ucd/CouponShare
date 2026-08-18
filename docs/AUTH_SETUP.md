# CouponShare authentication setup

CouponShare supports direct email/password accounts and Google OAuth through Supabase Auth. Existing device-key profiles are preserved and linked to the authenticated Supabase user on first successful sign-in.

## 1. Apply the profile migration

Apply:

`supabase/migrations/20260818070000_auth_profiles.sql`

This adds a nullable `profiles.auth_user_id` and a unique partial index. Existing profiles and Dunnes data are not deleted or rewritten.

## 2. Configure runtime environment variables

Required for account features:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `AUTH_SESSION_SECRET` or a sufficiently strong `ADMIN_PASSWORD` so CouponShare can derive the user-session signing secret

For the current production model, keep `AUTH_REQUIRED=false`. A fresh browser still cannot enter the application just by typing the production URL: it must either authenticate or explicitly choose Browse on `/login`.

Browse mode is read-only for voucher/account mutations. Authenticated users can upload, reserve, reveal, use, cancel, report, and manage their vouchers.

Set `AUTH_REQUIRED=true` only if Browse mode should be removed entirely in the future.

`SUPABASE_SERVICE_ROLE_KEY` remains server-only and is not used for the user-facing login requests added by this feature.

## 3. Supabase Auth URL configuration

In Supabase Dashboard > Authentication > URL Configuration:

- Set the Site URL to the deployed CouponShare origin.
- Add the deployed `/auth/callback` URL to the redirect allow list.
- Add local development callback URLs separately when needed.

The app passes `/auth/callback?returnTo=...&autoLogin=...` as the post-auth redirect.

## 4. Direct email/password sign-up

Enable email/password sign-in in Supabase Auth. Users can create a CouponShare account directly with an email address and password from `/login`.

The sign-up UI asks for the password twice and blocks submission when the two values do not match.

If email confirmation is enabled, Supabase sends a confirmation message. After confirmation or the next successful sign-in, CouponShare links the Supabase Auth user to the existing device-key profile.

## 5. Google quick sign-up and sign-in

In Google Cloud:

1. Configure the OAuth consent/audience settings.
2. Create a Web OAuth client.
3. Use the Supabase Google callback URL shown by the Supabase provider configuration as the authorized redirect URI.
4. Copy the Google Client ID and Client Secret into Supabase Dashboard > Authentication > Providers > Google and enable the provider.

The CouponShare Google button starts the flow through Supabase `/auth/v1/authorize?provider=google`. The Auto login choice is carried through the OAuth callback before CouponShare creates its HttpOnly session.

## 6. Auto login

The login screen and authenticated `/profile` page both expose an Auto login setting.

- ON: CouponShare persists the signed account cookie for up to 30 days on that device.
- OFF: the account cookie has no Max-Age and is limited to the current browser session.
- Logging out clears both the account session and any active Browse session.

## 7. Explicit Browse entry

The intended entry behavior is:

- A fresh browser that types the production URL is redirected to `/login`.
- The user must sign in/create an account or press `Browse without signing in`.
- Browse creates a short-lived signed HttpOnly browse session.
- Browse can view the normal application and Dunnes voucher lists.
- Browse cannot upload vouchers, reserve vouchers, reveal reserved barcodes, mark vouchers used, cancel reservations, or perform coupon-wallet mutations.
- `/profile` always requires a real authenticated account.
- Server routes independently reject protected writes with `401 auth_required`.

## 8. Safe rollout checks

1. Deploy code with `AUTH_REQUIRED=false`.
2. Apply the migration.
3. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to Cloud Run runtime configuration.
4. Configure the Supabase Site URL and `/auth/callback` redirect.
5. Test direct email sign-up, confirmation, and sign-in.
6. Configure and test Google sign-up/sign-in.
7. Confirm that an existing user's vouchers/reservations remain available after login.
8. Confirm the same account restores the same profile on another device.
9. Confirm Auto login ON survives a browser restart and OFF is session-only.
10. In a fresh private/incognito window, confirm typing the production URL redirects to `/login`.
11. Confirm the Browse button enters the app but upload/reserve redirects to login and is rejected server-side without a session.
12. Confirm the main-page Profile settings button opens `/profile` only for authenticated users.

## Invite-code retirement

The previous invitation/access-code gate has been retired. The normal entry screen is `/login`, with authenticated account entry or explicit read-only Browse entry, while admin authentication remains separate.
