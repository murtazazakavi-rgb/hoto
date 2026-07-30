import { NextResponse } from "next/server";
import { isTeableConfigured, seedDefaultYear } from "../../../lib/teable.js";

export async function POST(request) {
  const body = await request.json();
  const passcode = body.passcode || "";
  const expected = process.env.SUPER_ADMIN_PASSCODE || "786";
  const year = body.year || process.env.HOTO_DEFAULT_YEAR || "1448H";
  const records = Array.isArray(body.records) ? body.records : [];

  if (passcode !== expected) {
    return NextResponse.json({ error: "Super Admin access denied." }, { status: 403 });
  }

  if (!isTeableConfigured()) {
    return NextResponse.json({ error: "Teable is not configured." }, { status: 503 });
  }

  const result = await seedDefaultYear(year, records);
  return NextResponse.json({ year, ...result });
}
