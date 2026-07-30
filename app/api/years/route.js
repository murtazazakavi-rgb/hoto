import { NextResponse } from "next/server";
import { isTeableConfigured, listYears } from "../../../lib/teable.js";

export async function GET() {
  if (!isTeableConfigured()) {
    return NextResponse.json({ years: [process.env.HOTO_DEFAULT_YEAR || "1448H"], source: "local-demo" });
  }

  const years = await listYears(process.env.HOTO_DEFAULT_YEAR || "1448H");
  return NextResponse.json({ years, source: "teable" });
}
