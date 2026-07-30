import { NextResponse } from "next/server";
import { isTeableConfigured, listSchedulesByYear, syncSchedulesForYear } from "../../../lib/teable.js";
import { normalizeYear } from "../../../lib/field-map.js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const year = normalizeYear(searchParams.get("year") || process.env.HOTO_DEFAULT_YEAR || "1448H");

  if (!isTeableConfigured()) {
    return NextResponse.json({ records: [], year, source: "local-demo" });
  }

  const records = await listSchedulesByYear(year);
  return NextResponse.json({ records, year, source: "teable" });
}

export async function PUT(request) {
  const { searchParams } = new URL(request.url);
  const year = normalizeYear(searchParams.get("year") || process.env.HOTO_DEFAULT_YEAR || "1448H");
  const body = await request.json();
  const records = Array.isArray(body.records) ? body.records : [];

  if (!isTeableConfigured()) {
    return NextResponse.json({ error: "Teable is not configured." }, { status: 503 });
  }

  const saved = await syncSchedulesForYear(year, records);
  return NextResponse.json({ records: saved, year, source: "teable" });
}
