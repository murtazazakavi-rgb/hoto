const LEGACY_STORAGE_KEY = "hoto-simple-schedules-1448h-v1";
const STORAGE_KEY_PREFIX = "hoto-simple-schedules-";
const ACTIVE_YEAR_STORAGE_KEY = "hoto-simple-active-year-v1";
const DEFAULT_YEAR = "1448H";
const SEED_CONTACT_FIELDS = [
  "handoverAmilName",
  "handoverAmilMobile",
  "handoverImaeFatemaName",
  "handoverImaeFatemaMobile",
  "takeoverAmilName",
  "takeoverAmilMobile",
  "takeoverImaeFatemaName",
  "takeoverImaeFatemaMobile"
];
const SEED_BACKFILL_FIELDS = ["jamiat", "jamaatMauze", "musaedahName", "timeZone", "sourceFileName"];
const activeYear = loadActiveYear();
let schedules = loadSchedules(activeYear);
let databaseMode = "local-demo";

const $ = (id) => document.getElementById(id);

async function apiRequest(path) {
  const response = await fetch(path);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed.");
  return data;
}

async function hydrateFromServer() {
  try {
    const config = await apiRequest("/api/config");
    databaseMode = config.database || "local-demo";
    if (databaseMode !== "teable") return;
    const data = await apiRequest(`/api/schedules?year=${encodeURIComponent(activeYear)}`);
    if (Array.isArray(data.records)) {
      schedules = mergeSeedData(data.records, activeYear);
      localStorage.setItem(getScheduleStorageKey(activeYear), JSON.stringify(schedules));
      renderParticipantCards();
    }
  } catch (error) {
    showToast(error.message || "Could not load HOTO data.");
  }
}

function normalizeYear(value) {
  const cleaned = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return "";
  return cleaned.endsWith("H") ? cleaned : `${cleaned}H`;
}

function getScheduleStorageKey(year) {
  return `${STORAGE_KEY_PREFIX}${normalizeYear(year).toLowerCase()}-v1`;
}

function loadActiveYear() {
  const urlYear = normalizeYear(new URLSearchParams(window.location.search).get("year"));
  const storedYear = normalizeYear(localStorage.getItem(ACTIVE_YEAR_STORAGE_KEY));
  return urlYear || storedYear || DEFAULT_YEAR;
}

function getSeedSchedulesForYear(year) {
  const seedYear = normalizeYear(window.HOTO_IMPORTED_META?.cycle || DEFAULT_YEAR);
  const requestedYear = normalizeYear(year);
  const seedRecords = Array.isArray(window.HOTO_IMPORTED_SCHEDULES) ? window.HOTO_IMPORTED_SCHEDULES : [];
  if (!seedRecords.length || seedYear !== requestedYear) return [];
  return seedRecords.map((record) => ({ ...record }));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getRecordSeedKey(record) {
  return String(record?.sourceSrNo || "").trim();
}

function getRecordPlaceKey(record) {
  return `${normalize(record?.jamiat)}|${normalize(record?.jamaatMauze)}`;
}

function mergeSeedData(records, year) {
  const seeds = getSeedSchedulesForYear(year);
  if (!seeds.length || !Array.isArray(records)) return Array.isArray(records) ? records : [];
  const seedsBySrNo = new Map(seeds.map((record) => [getRecordSeedKey(record), record]).filter(([key]) => key));
  const seedsByPlace = new Map(seeds.map((record) => [getRecordPlaceKey(record), record]).filter(([key]) => key !== "|"));

  return records.map((record) => {
    const seed = seedsBySrNo.get(getRecordSeedKey(record)) || seedsByPlace.get(getRecordPlaceKey(record));
    if (!seed) return record;
    const merged = { ...record };
    SEED_BACKFILL_FIELDS.forEach((field) => {
      if (!merged[field] && seed[field]) merged[field] = seed[field];
    });
    SEED_CONTACT_FIELDS.forEach((field) => {
      merged[field] = seed[field] || "";
    });
    return merged;
  });
}

function repairStoredSchedules(year, records) {
  const repaired = mergeSeedData(records, year);
  if (JSON.stringify(repaired) !== JSON.stringify(records)) {
    localStorage.setItem(getScheduleStorageKey(year), JSON.stringify(repaired));
  }
  return repaired;
}

function getDefaultSchedulesForYear(year) {
  return getSeedSchedulesForYear(year);
}

function loadSchedules(year = activeYear) {
  const normalizedYear = normalizeYear(year) || DEFAULT_YEAR;
  const stored = localStorage.getItem(getScheduleStorageKey(normalizedYear));
  if (!stored && normalizedYear === normalizeYear(DEFAULT_YEAR)) {
    const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyStored) {
      localStorage.setItem(getScheduleStorageKey(normalizedYear), legacyStored);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return loadSchedules(normalizedYear);
    }
  }
  if (!stored) return getDefaultSchedulesForYear(normalizedYear);
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? repairStoredSchedules(normalizedYear, parsed) : getDefaultSchedulesForYear(normalizedYear);
  } catch {
    return getDefaultSchedulesForYear(normalizedYear);
  }
}

function formatDate(dateValue) {
  if (!dateValue) return "Date pending";
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatTimeRange(record) {
  if (!record.startTime && !record.endTime) return "Time pending";
  if (record.startTime && record.endTime) return `${record.startTime} - ${record.endTime}`;
  return record.startTime || record.endTime;
}

function canCreateCalendarEvent(record) {
  if (!(record.scheduledDate && record.startTime && record.endTime)) return false;
  const start = timeToMinutes(record.startTime);
  const end = timeToMinutes(record.endTime);
  return start !== null && end !== null && start < end;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function googleDateTime(dateValue, timeValue) {
  return `${dateValue.replaceAll("-", "")}T${timeValue.replace(":", "")}00`;
}

function formatContactForMessage(name, mobile) {
  const contactName = String(name || "").trim() || "To be confirmed";
  const contactMobile = String(mobile || "").trim();
  return contactMobile ? `${contactName} | Mobile: ${contactMobile}` : `${contactName} | Mobile: To be confirmed`;
}

function getWhatsAppNumber(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

function buildWhatsAppUrlForMobile(mobile, record) {
  const number = getWhatsAppNumber(mobile);
  const target = number ? `/${number}` : "";
  return `https://wa.me${target}?text=${encodeURIComponent(formatMessage(record))}`;
}

function renderContactCell(name, mobile, record) {
  const contactName = String(name || "").trim();
  const contactMobile = String(mobile || "").trim();
  if (!contactName && !contactMobile) return `<span class="muted">To be confirmed</span>`;
  const displayName = contactName || "Name pending";
  const mobileMarkup = contactMobile
    ? `<a class="contact-phone" href="${escapeAttribute(buildWhatsAppUrlForMobile(contactMobile, record))}" target="_blank" rel="noreferrer" aria-label="Message ${escapeAttribute(displayName)} on WhatsApp">${escapeHtml(contactMobile)}</a>`
    : `<small class="muted">Mobile pending</small>`;
  return `
    <span class="contact-cell">
      <strong>${escapeHtml(displayName)}</strong>
      ${mobileMarkup}
    </span>
  `;
}

function renderParticipantContact(label, name, mobile, record) {
  return `<p class="contact-meta"><span>${escapeHtml(label)}</span>${renderContactCell(name, mobile, record)}</p>`;
}

function buildCalendarDetails(record) {
  return [
    `Jamiat: ${record.jamiat}`,
    `Jamaat / Mauze: ${record.jamaatMauze}`,
    `Handing Amil / Masool: ${formatContactForMessage(record.handoverAmilName, record.handoverAmilMobile)}`,
    `Handing Imae Fatema / Azwaaj: ${formatContactForMessage(record.handoverImaeFatemaName, record.handoverImaeFatemaMobile)}`,
    `Taking Amil / Masool: ${formatContactForMessage(record.takeoverAmilName, record.takeoverAmilMobile)}`,
    `Taking Imae Fatema / Azwaaj: ${formatContactForMessage(record.takeoverImaeFatemaName, record.takeoverImaeFatemaMobile)}`,
    `Musaedah: ${record.musaedahName || "To be confirmed"}`,
    `Google Meet Link: ${record.meetingLink || "To be shared"}`,
    "",
    "Instructions:",
    record.instructions || "Please join on time and keep HOTO notes ready."
  ].join("\n");
}

function buildGoogleCalendarUrl(record) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `HOTO - ${record.jamaatMauze}`,
    dates: `${googleDateTime(record.scheduledDate, record.startTime)}/${googleDateTime(record.scheduledDate, record.endTime)}`,
    ctz: record.timeZone || "Asia/Kolkata",
    details: buildCalendarDetails(record),
    location: record.meetingLink || record.jamaatMauze
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatMessage(record) {
  return `Baad al Salaam al Jazeel,

HOTO (Hand Over Take Over) has been scheduled for the following Mauze.

Jamiat: ${record.jamiat}
Jamaat / Mauze: ${record.jamaatMauze}
Handing Amil / Masool: ${formatContactForMessage(record.handoverAmilName, record.handoverAmilMobile)}
Handing Imae Fatema / Azwaaj: ${formatContactForMessage(record.handoverImaeFatemaName, record.handoverImaeFatemaMobile)}
Taking Amil / Masool: ${formatContactForMessage(record.takeoverAmilName, record.takeoverAmilMobile)}
Taking Imae Fatema / Azwaaj: ${formatContactForMessage(record.takeoverImaeFatemaName, record.takeoverImaeFatemaMobile)}
Date: ${formatDate(record.scheduledDate)}
Time: ${formatTimeRange(record)} (${record.timeZone})
Meeting Link: ${record.meetingLink || "To be shared"}

Please keep this message for reference.`;
}

function renderParticipantCards() {
  const query = $("participantSearch").value.trim().toLowerCase();
  if (!query) {
    $("participantCards").innerHTML = "";
    return;
  }

  const rows = schedules.filter((record) => {
    const haystack = [
      record.jamiat,
      record.jamaatMauze,
      record.handoverAmilName,
      record.handoverAmilMobile,
      record.handoverImaeFatemaName,
      record.handoverImaeFatemaMobile,
      record.takeoverAmilName,
      record.takeoverAmilMobile,
      record.takeoverImaeFatemaName,
      record.takeoverImaeFatemaMobile,
      record.musaedahName
    ].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  $("participantCards").innerHTML = rows.map((record) => `
    <article class="participant-card participant-result-card">
      <div class="card-top">
        <div>
          <p class="kicker">${escapeHtml(record.jamiat)}</p>
          <h3>${escapeHtml(record.jamaatMauze)}</h3>
        </div>
        <span class="badge ${record.status.toLowerCase()}">${escapeHtml(record.status)}</span>
      </div>
      <div class="meta-grid">
        ${renderParticipantContact("Handing Amil / Masool", record.handoverAmilName, record.handoverAmilMobile, record)}
        ${renderParticipantContact("Handing Imae Fatema / Azwaaj", record.handoverImaeFatemaName, record.handoverImaeFatemaMobile, record)}
        ${renderParticipantContact("Taking Amil / Masool", record.takeoverAmilName, record.takeoverAmilMobile, record)}
        ${renderParticipantContact("Taking Imae Fatema / Azwaaj", record.takeoverImaeFatemaName, record.takeoverImaeFatemaMobile, record)}
        <p><span>Musaedah</span>${escapeHtml(record.musaedahName)}</p>
        <p><span>Date</span>${formatDate(record.scheduledDate)}</p>
        <p><span>Time</span>${escapeHtml(formatTimeRange(record))}</p>
        <p><span>Time zone</span>${escapeHtml(record.timeZone)}</p>
      </div>
      <p class="instructions"><strong>Instructions:</strong> ${escapeHtml(record.instructions || "Please join on time.")}</p>
      <div class="participant-actions">
        ${record.meetingLink ? `<a class="btn btn-primary" href="${escapeAttribute(record.meetingLink)}" target="_blank" rel="noreferrer">Join Meeting</a>` : `<button class="btn btn-primary" type="button" disabled>Join Meeting</button>`}
        <button class="btn btn-secondary" type="button" data-action="calendar" data-id="${record.id}">Add Calendar</button>
      </div>
    </article>
  `).join("") || `
    <div class="empty-state participant-no-results">
      <img src="assets/da-motif.svg" alt="" />
      <strong>No HOTO records found.</strong>
      <span>Check the spelling of your Mauze or name and search again.</span>
    </div>
  `;
}

async function copyMessage(record) {
  try {
    await navigator.clipboard.writeText(formatMessage(record));
    showToast("HOTO details copied.");
  } catch {
    showToast("Copy failed. Please copy manually.");
  }
}

function openGoogleCalendar(record) {
  if (!canCreateCalendarEvent(record)) {
    showToast("Date and time are not scheduled yet.");
    return;
  }
  window.open(buildGoogleCalendarUrl(record), "_blank", "noopener,noreferrer");
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const record = schedules.find((item) => item.id === actionButton.dataset.id);
  if (!record) return;
  if (actionButton.dataset.action === "calendar") openGoogleCalendar(record);
  if (actionButton.dataset.action === "copy") copyMessage(record);
});

$("participantSearch").addEventListener("input", renderParticipantCards);
$("participantYearLabel").textContent = activeYear;
renderParticipantCards();
hydrateFromServer();
