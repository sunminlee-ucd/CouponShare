import {
  USER_AUTH_COOKIE_NAME,
  readCookie,
  verifyUserAuthToken,
} from "@/app/auth/session";
import {
  MAINTENANCE_TEST_COOKIE_NAME,
  verifyMaintenanceTestToken,
} from "@/app/maintenance-test-access";
import { readMaintenanceStatus } from "@/app/maintenance-mode";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const status = await readMaintenanceStatus();
  if (!status.enabled) {
    return Response.json(
      { enabled: false, blocked: false },
      { headers: { "cache-control": "private, no-store" } },
    );
  }

  const cookieHeader = request.headers.get("cookie");
  const testerGrant = await verifyMaintenanceTestToken(
    readCookie(cookieHeader, MAINTENANCE_TEST_COOKIE_NAME),
  );
  const testerSession = testerGrant
    ? await verifyUserAuthToken(readCookie(cookieHeader, USER_AUTH_COOKIE_NAME))
    : null;
  const testerAllowed = Boolean(
    testerGrant
      && testerSession
      && testerSession.authUserId === testerGrant.authUserId,
  );

  return Response.json(
    { enabled: true, blocked: !testerAllowed },
    {
      headers: {
        "cache-control": "private, no-store",
        "retry-after": testerAllowed ? "0" : "10",
      },
    },
  );
}
