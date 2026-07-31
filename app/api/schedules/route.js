import { NextResponse } from "next/server";
import { isTeableConfigured, listSchedulesByYear, syncSchedulesForYear } from "../../../lib/teable.js";
import { normalizeYear } from "../../../lib/field-map.js";
import { validateScheduleBatch } from "../../../lib/schedule-conflicts.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = normalizeYear(searchParams.get("year") || process.env.HOTO_DEFAULT_YEAR || "1448H");

    if (!isTeableConfigured()) {
      return NextResponse.json({ records: [], year, source: "local-demo" });
    }

    const records = await listSchedulesByYear(year);
    return NextResponse.json({ records, year, source: "teable" });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not load schedules." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = normalizeYear(searchParams.get("year") || process.env.HOTO_DEFAULT_YEAR || "1448H");
    const body = await request.json();
    const records = Array.isArray(body.records) ? body.records : [];

    if (!isTeableConfigured()) {
      return NextResponse.json({ error: "Teable is not configured." }, { status: 503 });
    }

    const existingRecords = await listSchedulesByYear(year);
    const nextById = new Map(existingRecords.map((record) => [record.id, record]));
    records.forEach((record) => nextById.set(record.id, record));
    const validation = validateScheduleBatch([...nextById.values()]);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.message }, { status: 409 });
    }

    const saved = await syncSchedulesForYear(year, records);
    return NextResponse.json({ records: saved, year, source: "teable" });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save schedules." }, { status: 500 });
  }
}
