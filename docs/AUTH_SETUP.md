# CouponShare authentication setup

CouponShare supports email/password accounts plus Google and Apple OAuth through Supabase Auth. Existing device-key profiles are preserved and linked to the authenticated Supabase user on first successful sign-in.

## 1. Apply the profile migration

Apply:

`supabase/migrations/20260818070000_auth_profiles.sql`

This adds a nullable `profiles.auth_user_id` and a unique partial index. Existing profiles and Dunnes data are not deleted or rewritten.

## 2. Configure runtime environment variables

Required for account features:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `APP_SESSION_SECRET` or a sufficiently strong `ADMIN_PASSWORD` so the existing session-secret derivation is available

Keep `AUTH_REQUIRED=false` while testing. After email, Google, Apple, callback, cross-device profile recovery, and logout are verified in production, switch to `AUTH_REQUIRED=true` to require a user account for normal app pages and APIs.

`SUPABASE_SERVICE_ROLE_KEY` remains server-only and is not used for the user-facing login requests added by this feature.

## 3. Supabase Auth URL configuration

In Supabase Dashboard > Authentication > URL Configuration:

- Set the Site URL to the deployed CouponShare origin.
- Add the deployed `/auth/callback` URL to the redirect allow list.
- Add local development callback URLs separately when needed.

The app passes `/auth/callback?returnTo=...` as the post-auth redirect.

## 4. Email/password

Enable email/password sign-in in Supabase Auth. If email confirmation is enabled, Supabase will send a confirmation message and return the user to `/auth/callback` after confirmation.

## 5. Google

In Google Cloud:

1. Configure the OAuth consent/audience settings.
2. Create a Web OAuth client.
3. Use the Supabase Google callback URL shown by the Supabase provider configuration as the authorized redirect URI.
4. Copy the Google Client ID and Client Secret into Supabase Dashboard > Authentication > Providers > Google and enable the provider.

The CouponShare button starts the flow through Supabase `/auth/v1/authorize?provider=google`.

## 6. Apple

A configured Apple Developer account is required for web Sign in with Apple.

1. Configure an App ID with Sign in with Apple.
2. Create a Services ID for the website.
3. Configure the deployed website domain and the Supabase Apple callback/return URL in Apple Developer.
4. Create the Apple signing key and collect the Team ID and Key ID.
5. Configure the Apple provider in Supabase Auth and enable it. For a web OAuth flow, make sure the Services ID is the web client identifier expected by Supabase.

The CouponShare button starts the flow through Supabase `/auth/v1/authorize?provider=apple`.

## 7. Safe rollout order

1. Deploy code with `AUTH_REQUIRED=false`.
2. Apply the migration.
3. Add `SUPABASE_PUBLISHABLE_KEY` to Cloud Run runtime configuration.
4. Test email sign-up/sign-in.
5. Test Google sign-in.
6. Test Apple sign-in on Safari and at least one other browser.
7. Confirm that an existing user's vouchers/reservations remain available after login.
8. Confirm the same account restores the same profile on another device.
9. Confirm logout works.
10. Only then set `AUTH_REQUIRED=true` if login should become mandatory.

## Current private-access gate

The existing CouponShare invitation/access-code gate remains separate from user authentication. This rollout intentionally does not remove it. A future public launch can retire or make the private-access gate optional after account auth is fully verified.
