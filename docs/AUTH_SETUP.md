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

Keep `AUTH_REQUIRED=false` while testing. After email/password, Google, callback, cross-device profile recovery, and logout are verified in production, switch to `AUTH_REQUIRED=true` to require a user account for normal app pages and APIs.

`SUPABASE_SERVICE_ROLE_KEY` remains server-only and is not used for the user-facing login requests added by this feature.

## 3. Supabase Auth URL configuration

In Supabase Dashboard > Authentication > URL Configuration:

- Set the Site URL to the deployed CouponShare origin.
- Add the deployed `/auth/callback` URL to the redirect allow list.
- Add local development callback URLs separately when needed.

The app passes `/auth/callback?returnTo=...` as the post-auth redirect.

## 4. Direct email/password sign-up

Enable email/password sign-in in Supabase Auth. Users can create a CouponShare account directly with an email address and password from `/login`.

If email confirmation is enabled, Supabase sends a confirmation message and returns the user to `/auth/callback` after confirmation.

## 5. Google quick sign-up and sign-in

In Google Cloud:

1. Configure the OAuth consent/audience settings.
2. Create a Web OAuth client.
3. Use the Supabase Google callback URL shown by the Supabase provider configuration as the authorized redirect URI.
4. Copy the Google Client ID and Client Secret into Supabase Dashboard > Authentication > Providers > Google and enable the provider.

The CouponShare Google button starts the flow through Supabase `/auth/v1/authorize?provider=google`.

## 6. Safe rollout order

1. Deploy code with `AUTH_REQUIRED=false`.
2. Apply the migration.
3. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to Cloud Run runtime configuration.
4. Configure the Supabase Site URL and `/auth/callback` redirect.
5. Test direct email sign-up and sign-in.
6. Configure and test Google sign-up/sign-in.
7. Confirm that an existing user's vouchers/reservations remain available after login.
8. Confirm the same account restores the same profile on another device.
9. Confirm logout works.
10. Only then set `AUTH_REQUIRED=true` when login should become mandatory.

## Invite-code retirement

The previous invitation/access-code gate has been retired. `/access` now redirects to `/login`, the legacy `/api/access` endpoint no longer accepts codes, and the normal application gate is the Supabase-backed user account session when `AUTH_REQUIRED=true`.
