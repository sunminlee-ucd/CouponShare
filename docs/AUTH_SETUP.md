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

For the current production model, keep `AUTH_REQUIRED=false`. Guests may browse the normal CouponShare and Dunnes pages, but server middleware requires a valid CouponShare account session for Dunnes write/reveal requests such as upload, reserve, mark-used, cancel, report, and barcode reveal.

Set `AUTH_REQUIRED=true` only if the entire normal application should become login-only in the future.

`SUPABASE_SERVICE_ROLE_KEY` remains server-only and is not used for the user-facing login requests added by this feature.

## 3. Supabase Auth URL configuration

In Supabase Dashboard > Authentication > URL Configuration:

- Set the Site URL to the deployed CouponShare origin.
- Add the deployed `/auth/callback` URL to the redirect allow list.
- Add local development callback URLs separately when needed.

The app passes `/auth/callback?returnTo=...` as the post-auth redirect.

## 4. Direct email/password sign-up

Enable email/password sign-in in Supabase Auth. Users can create a CouponShare account directly with an email address and password from `/login`.

The CouponShare sign-up UI asks for the password twice and blocks submission when the two values do not match.

If email confirmation is enabled, Supabase sends a confirmation message. After confirmation, the user signs in and CouponShare links the Supabase Auth user to the existing device-key profile.

## 5. Google quick sign-up and sign-in

In Google Cloud:

1. Configure the OAuth consent/audience settings.
2. Create a Web OAuth client.
3. Use the Supabase Google callback URL shown by the Supabase provider configuration as the authorized redirect URI.
4. Copy the Google Client ID and Client Secret into Supabase Dashboard > Authentication > Providers > Google and enable the provider.

The CouponShare Google button starts the flow through Supabase `/auth/v1/authorize?provider=google`. After a successful Google callback, CouponShare creates its HttpOnly user session and redirects back to the requested page, normally the main page.

## 6. Guest browsing and protected actions

The intended public behavior is:

- Guests can open the main page and Dunnes voucher list directly.
- Guests cannot upload vouchers, reserve vouchers, reveal reserved barcodes, mark vouchers used, cancel reservations, or perform other Dunnes write actions.
- Clicking an upload or reservation action while logged out redirects to `/login?returnTo=/dunnes`.
- The server independently rejects unauthenticated Dunnes write requests with `401 auth_required`, so the restriction does not rely only on the browser UI.

## 7. Safe rollout order

1. Deploy code with `AUTH_REQUIRED=false`.
2. Apply the migration.
3. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to Cloud Run runtime configuration.
4. Configure the Supabase Site URL and `/auth/callback` redirect.
5. Test direct email sign-up, confirmation, and sign-in.
6. Configure and test Google sign-up/sign-in.
7. Confirm that an existing user's vouchers/reservations remain available after login.
8. Confirm the same account restores the same profile on another device.
9. Confirm logout works.
10. In a private/incognito window, confirm browsing works while upload/reserve redirects to login.

## Invite-code retirement

The previous invitation/access-code gate has been retired. The normal public experience is guest browsing plus account-protected actions, while admin authentication remains separate.
