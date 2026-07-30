import { recordToTeableFields, teableRecordToSchedule, TEABLE_FIELDS, normalizeYear } from "./field-map.js";

const DEFAULT_BASE_URL = "https://app.teable.ai";

export function getTeableConfig() {
  return {
    baseUrl: (process.env.TEABLE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    token: process.env.TEABLE_TOKEN || "",
    tableId: process.env.TEABLE_HOTO_TABLE_ID || ""
  };
}

export function isTeableConfigured() {
  const config = getTeableConfig();
  return Boolean(config.token && config.tableId);
}

async function teableFetch(path, options = {}) {
  const config = getTeableConfig();
  if (!isTeableConfigured()) {
    throw new Error("Teable is not configured. Set TEABLE_TOKEN and TEABLE_HOTO_TABLE_ID.");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Teable request failed with ${response.status}`);
  }
  return data;
}

export async function listAllSchedules() {
  const { tableId } = getTeableConfig();
  const records = [];
  let skip = 0;
  const take = 1000;

  while (true) {
    const params = new URLSearchParams({
      take: String(take),
      skip: String(skip),
      fieldKeyType: "name",
      cellFormat: "json"
    });
    const data = await teableFetch(`/api/table/${tableId}/record?${params.toString()}`);
    const batch = data?.records || [];
    records.push(...batch);
    if (batch.length < take) break;
    skip += take;
  }

  return records.map(teableRecordToSchedule);
}

export async function listSchedulesByYear(year) {
  const normalizedYear = normalizeYear(year);
  const schedules = await listAllSchedules();
  return schedules.filter((record) => normalizeYear(record.year) === normalizedYear);
}

export async function listYears(defaultYear = "1448H") {
  const schedules = await listAllSchedules();
  const years = new Set([normalizeYear(defaultYear)]);
  schedules.forEach((record) => {
    const year = normalizeYear(record.year);
    if (year) years.add(year);
  });
  return [...years].sort((a, b) => a.localeCompare(b));
}

export async function syncSchedulesForYear(year, schedules) {
  const normalizedYear = normalizeYear(year);
  const { tableId } = getTeableConfig();
  const existing = await listSchedulesByYear(normalizedYear);
  const existingByAppId = new Map(existing.map((record) => [record.id, record]));
  const updated = [];

  for (const record of schedules) {
    const next = {
      ...record,
      year: normalizedYear,
      lastUpdatedAt: record.lastUpdatedAt || new Date().toISOString()
    };
    const existingRecord = record.teableRecordId
      ? { teableRecordId: record.teableRecordId }
      : existingByAppId.get(record.id);
    if (existingRecord?.teableRecordId) {
      const data = await teableFetch(`/api/table/${tableId}/record/${existingRecord.teableRecordId}`, {
        method: "PATCH",
        body: JSON.stringify({
          fieldKeyType: "name",
          typecast: true,
          record: { fields: recordToTeableFields(next, normalizedYear) }
        })
      });
      updated.push(teableRecordToSchedule(data));
    } else {
      const data = await teableFetch(`/api/table/${tableId}/record`, {
        method: "POST",
        body: JSON.stringify({
          fieldKeyType: "name",
          typecast: true,
          records: [{ fields: recordToTeableFields(next, normalizedYear) }]
        })
      });
      updated.push(...(data.records || []).map(teableRecordToSchedule));
    }
  }

  return updated;
}

export async function seedDefaultYear(year, schedules) {
  const existing = await listSchedulesByYear(year);
  if (existing.length) return { created: 0, skipped: existing.length };
  const synced = await syncSchedulesForYear(year, schedules);
  return { created: synced.length, skipped: 0 };
}

export function requiredTeableFieldsMarkdown() {
  return Object.values(TEABLE_FIELDS).map((field) => `- ${field}`).join("\n");
}
