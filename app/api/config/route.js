import { NextResponse } from "next/server";
import { isTeableConfigured, requiredTeableFieldsMarkdown } from "../../../lib/teable.js";

export async function GET() {
  return NextResponse.json({
    database: isTeableConfigured() ? "teable" : "local-demo",
    defaultYear: process.env.HOTO_DEFAULT_YEAR || "1448H",
    teableConfigured: isTeableConfigured(),
    requiredFields: requiredTeableFieldsMarkdown()
  });
}
