export const runtime = "nodejs";

function retired() {
  return Response.json({ error: "invite_access_removed" }, {
    status: 410,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST() {
  return retired();
}

export async function DELETE() {
  return retired();
}
