# Maintenance test access

Maintenance mode keeps normal users behind the maintenance screen while allowing two admin-launched test accounts to sign in and exercise the live application.

## Flow

1. An authenticated admin enables maintenance mode.
2. In the Maintenance tab, the admin selects one approved test account.
3. The admin launcher clears the current user session and issues a short-lived, signed pre-auth maintenance-test cookie for that email.
4. Only that browser can reach the login/auth routes during maintenance.
5. After successful authentication, the server verifies that the authenticated email exactly matches the selected approved email.
6. The maintenance-test cookie is rebound to the authenticated user ID and allows normal app/API access during maintenance.
7. Normal users and non-approved accounts continue to receive the maintenance screen or HTTP 503 responses.
8. Logging out clears the maintenance-test cookie.

The approved tester list is intentionally server-side and limited to the two configured test accounts.