export const TEABLE_FIELDS = {
  appId: "App ID",
  year: "Year",
  sourceSrNo: "Sr. No.",
  jamiat: "Jamiat",
  jamaatMauze: "Jamaat / Mauze",
  handoverImaeFatemaName: "Being Handed By Zawjat of",
  takeoverImaeFatemaName: "Being Taken By Zawjat of",
  handoverAmilName: "Handing Amil",
  takeoverAmilName: "Taking Amil",
  handoverAmilMobile: "Handing Amil Mobile",
  handoverImaeFatemaMobile: "Handing Imae Fatema Mobile",
  takeoverAmilMobile: "Taking Amil Mobile",
  takeoverImaeFatemaMobile: "Taking Imae Fatema Mobile",
  musaedahName: "Musaedah",
  scheduledDate: "Date",
  startTime: "Start Time",
  endTime: "End Time",
  timeZone: "Time Zone",
  meetingLink: "Google Meet Link",
  instructions: "Instructions",
  status: "Status",
  remarks: "Remarks",
  lastMessageSentAt: "Last Message Sent At",
  lastUpdatedBy: "Last Updated By",
  lastUpdatedAt: "Last Updated At",
  sourceFileName: "Source File"
};

export function normalizeYear(value) {
  const cleaned = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return "";
  return cleaned.endsWith("H") ? cleaned : `${cleaned}H`;
}

export function recordToTeableFields(record, year) {
  const normalizedYear = normalizeYear(year || record.year);
  return {
    [TEABLE_FIELDS.appId]: record.id || "",
    [TEABLE_FIELDS.year]: normalizedYear,
    [TEABLE_FIELDS.sourceSrNo]: Number(record.sourceSrNo) || null,
    [TEABLE_FIELDS.jamiat]: record.jamiat || "",
    [TEABLE_FIELDS.jamaatMauze]: record.jamaatMauze || "",
    [TEABLE_FIELDS.handoverImaeFatemaName]: record.handoverImaeFatemaName || "",
    [TEABLE_FIELDS.takeoverImaeFatemaName]: record.takeoverImaeFatemaName || "",
    [TEABLE_FIELDS.handoverAmilName]: record.handoverAmilName || "",
    [TEABLE_FIELDS.takeoverAmilName]: record.takeoverAmilName || "",
    [TEABLE_FIELDS.handoverAmilMobile]: record.handoverAmilMobile || "",
    [TEABLE_FIELDS.handoverImaeFatemaMobile]: record.handoverImaeFatemaMobile || "",
    [TEABLE_FIELDS.takeoverAmilMobile]: record.takeoverAmilMobile || "",
    [TEABLE_FIELDS.takeoverImaeFatemaMobile]: record.takeoverImaeFatemaMobile || "",
    [TEABLE_FIELDS.musaedahName]: record.musaedahName || "",
    [TEABLE_FIELDS.scheduledDate]: record.scheduledDate || null,
    [TEABLE_FIELDS.startTime]: record.startTime || "",
    [TEABLE_FIELDS.endTime]: record.endTime || "",
    [TEABLE_FIELDS.timeZone]: record.timeZone || "Asia/Kolkata",
    [TEABLE_FIELDS.meetingLink]: record.meetingLink || "",
    [TEABLE_FIELDS.instructions]: record.instructions || "",
    [TEABLE_FIELDS.status]: record.status || "Draft",
    [TEABLE_FIELDS.remarks]: record.remarks || "",
    [TEABLE_FIELDS.lastMessageSentAt]: record.lastMessageSentAt || "",
    [TEABLE_FIELDS.lastUpdatedBy]: record.lastUpdatedBy || "",
    [TEABLE_FIELDS.lastUpdatedAt]: record.lastUpdatedAt || new Date().toISOString(),
    [TEABLE_FIELDS.sourceFileName]: record.sourceFileName || ""
  };
}

export function teableRecordToSchedule(record) {
  const fields = record.fields || {};
  return {
    id: fields[TEABLE_FIELDS.appId] || record.id,
    teableRecordId: record.id,
    year: fields[TEABLE_FIELDS.year] || "",
    sourceSrNo: fields[TEABLE_FIELDS.sourceSrNo] || "",
    jamiat: fields[TEABLE_FIELDS.jamiat] || "",
    jamaatMauze: fields[TEABLE_FIELDS.jamaatMauze] || "",
    handoverImaeFatemaName: fields[TEABLE_FIELDS.handoverImaeFatemaName] || "",
    takeoverImaeFatemaName: fields[TEABLE_FIELDS.takeoverImaeFatemaName] || "",
    handoverAmilName: fields[TEABLE_FIELDS.handoverAmilName] || "",
    takeoverAmilName: fields[TEABLE_FIELDS.takeoverAmilName] || "",
    handoverAmilMobile: fields[TEABLE_FIELDS.handoverAmilMobile] || "",
    handoverImaeFatemaMobile: fields[TEABLE_FIELDS.handoverImaeFatemaMobile] || "",
    takeoverAmilMobile: fields[TEABLE_FIELDS.takeoverAmilMobile] || "",
    takeoverImaeFatemaMobile: fields[TEABLE_FIELDS.takeoverImaeFatemaMobile] || "",
    musaedahName: fields[TEABLE_FIELDS.musaedahName] || "",
    scheduledDate: fields[TEABLE_FIELDS.scheduledDate] || "",
    startTime: fields[TEABLE_FIELDS.startTime] || "",
    endTime: fields[TEABLE_FIELDS.endTime] || "",
    timeZone: fields[TEABLE_FIELDS.timeZone] || "Asia/Kolkata",
    meetingLink: fields[TEABLE_FIELDS.meetingLink] || "",
    instructions: fields[TEABLE_FIELDS.instructions] || "",
    status: fields[TEABLE_FIELDS.status] || "Draft",
    remarks: fields[TEABLE_FIELDS.remarks] || "",
    lastMessageSentAt: fields[TEABLE_FIELDS.lastMessageSentAt] || "",
    lastUpdatedBy: fields[TEABLE_FIELDS.lastUpdatedBy] || "",
    lastUpdatedAt: fields[TEABLE_FIELDS.lastUpdatedAt] || "",
    sourceFileName: fields[TEABLE_FIELDS.sourceFileName] || ""
  };
}
