const LEGACY_STORAGE_KEY = "hoto-simple-schedules-1448h-v1";
const STORAGE_KEY_PREFIX = "hoto-simple-schedules-";
const YEARS_STORAGE_KEY = "hoto-simple-years-v1";
const ACTIVE_YEAR_STORAGE_KEY = "hoto-simple-active-year-v1";
const SUPER_ADMIN_PASSCODE = "786";
const ALL_MUSAEDAAT = "__ALL_MUSAEDAAT__";
const DEFAULT_YEAR = "1448H";

let activeYear = loadActiveYear();
let schedules = loadSchedules(activeYear);
let activeRecordId = "";
let databaseMode = "local-demo";
let serverSyncing = false;

const $ = (id) => document.getElementById(id);

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed.");
  return data;
}

async function loadServerConfig() {
  try {
    const data = await apiRequest("/api/config");
    databaseMode = data.database || "local-demo";
    return data;
  } catch {
    databaseMode = "local-demo";
    return { database: "local-demo" };
  }
}

async function hydrateFromServer() {
  const config = await loadServerConfig();
  if (config.database !== "teable") {
    showToast("Running in local demo mode. Add Teable environment variables before deployment.");
    return;
  }

  try {
    const yearsData = await apiRequest("/api/years");
    if (Array.isArray(yearsData.years) && yearsData.years.length) saveYears(yearsData.years);

    const data = await apiRequest(`/api/schedules?year=${encodeURIComponent(activeYear)}`);
    if (Array.isArray(data.records) && data.records.length) {
      schedules = data.records;
      localStorage.setItem(getScheduleStorageKey(activeYear), JSON.stringify(schedules));
      renderAll();
      showToast(`Loaded ${activeYear} from Teable.`);
    }
  } catch (error) {
    showToast(error.message || "Could not load Teable data.");
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

function loadYears() {
  const stored = localStorage.getItem(YEARS_STORAGE_KEY);
  const fallback = [DEFAULT_YEAR];
  if (!stored) return fallback;
  try {
    const parsed = JSON.parse(stored);
    const years = Array.isArray(parsed) ? parsed.map(normalizeYear).filter(Boolean) : fallback;
    return unique([...years, DEFAULT_YEAR]);
  } catch {
    return fallback;
  }
}

function saveYears(years) {
  localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify(unique(years.map(normalizeYear).filter(Boolean))));
}

function registerYear(year) {
  const nextYears = unique([...loadYears(), normalizeYear(year)]);
  saveYears(nextYears);
  return nextYears;
}

function loadActiveYear() {
  const stored = normalizeYear(localStorage.getItem(ACTIVE_YEAR_STORAGE_KEY));
  return stored || DEFAULT_YEAR;
}

function saveActiveYear(year) {
  activeYear = normalizeYear(year) || DEFAULT_YEAR;
  localStorage.setItem(ACTIVE_YEAR_STORAGE_KEY, activeYear);
}

function getDefaultSchedulesForYear(year) {
  return [];
}

function loadSchedules(year = activeYear) {
  const normalizedYear = normalizeYear(year) || DEFAULT_YEAR;
  const stored = localStorage.getItem(getScheduleStorageKey(normalizedYear));
  if (!stored && normalizedYear === normalizeYear(DEFAULT_YEAR)) {
    const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyStored) {
      localStorage.setItem(getScheduleStorageKey(normalizedYear), legacyStored);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      registerYear(normalizedYear);
      return loadSchedules(normalizedYear);
    }
  }
  if (!stored) return getDefaultSchedulesForYear(normalizedYear);
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : getDefaultSchedulesForYear(normalizedYear);
  } catch {
    return getDefaultSchedulesForYear(normalizedYear);
  }
}

function saveSchedules() {
  registerYear(activeYear);
  localStorage.setItem(getScheduleStorageKey(activeYear), JSON.stringify(schedules));
  if (databaseMode === "teable" && !serverSyncing) {
    serverSyncing = true;
    apiRequest(`/api/schedules?year=${encodeURIComponent(activeYear)}`, {
      method: "PUT",
      body: JSON.stringify({ records: schedules })
    })
      .then((data) => {
        if (Array.isArray(data.records)) {
          schedules = data.records;
          localStorage.setItem(getScheduleStorageKey(activeYear), JSON.stringify(schedules));
          renderAll();
        }
      })
      .catch((error) => showToast(error.message || "Could not save to Teable."))
      .finally(() => {
        serverSyncing = false;
      });
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
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

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function hasUsableTimeWindow(record) {
  return Boolean(record.scheduledDate && record.startTime && record.endTime);
}

function hasInvalidTimeWindow(record) {
  if (!record.startTime || !record.endTime) return false;
  const start = timeToMinutes(record.startTime);
  const end = timeToMinutes(record.endTime);
  return start !== null && end !== null && start >= end;
}

function getScheduleConflict(candidate, ignoreId = "") {
  if (!hasUsableTimeWindow(candidate) || !candidate.musaedahName || hasInvalidTimeWindow(candidate)) return null;
  const candidateStart = timeToMinutes(candidate.startTime);
  const candidateEnd = timeToMinutes(candidate.endTime);
  const candidateMusaedah = normalize(candidate.musaedahName);

  return schedules.find((record) => {
    if (record.id === ignoreId) return false;
    if (record.status === "Cancelled") return false;
    if (!hasUsableTimeWindow(record)) return false;
    if (record.scheduledDate !== candidate.scheduledDate) return false;
    if (normalize(record.musaedahName) !== candidateMusaedah) return false;

    const recordStart = timeToMinutes(record.startTime);
    const recordEnd = timeToMinutes(record.endTime);
    return candidateStart < recordEnd && recordStart < candidateEnd;
  }) || null;
}

function getConflictMessage(candidate, conflict) {
  return `${candidate.musaedahName} already has HOTO for ${conflict.jamaatMauze}, ${conflict.jamiat} on ${formatDate(conflict.scheduledDate)} from ${formatTimeRange(conflict)}. Choose a different date or time.`;
}

function addDays(dateValue, days) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMinutes(timeValue, minutesToAdd) {
  const total = timeToMinutes(timeValue) + minutesToAdd;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isAutoSchedulable(record, musaedahName, jamiatName) {
  if (musaedahName !== ALL_MUSAEDAAT && normalize(record.musaedahName) !== normalize(musaedahName)) return false;
  if (normalize(record.jamiat) !== normalize(jamiatName)) return false;
  if (record.status === "Completed" || record.status === "Cancelled") return false;
  return record.status === "Draft" || !hasUsableTimeWindow(record);
}

function getAutoScheduleCandidates(musaedahName, jamiatName) {
  return schedules
    .filter((record) => isAutoSchedulable(record, musaedahName, jamiatName))
    .sort((a, b) => (Number(a.sourceSrNo) || 99999) - (Number(b.sourceSrNo) || 99999));
}

function buildAutoScheduleSlots(config) {
  const slots = [];
  const dayStart = timeToMinutes(config.workStart);
  const dayEnd = timeToMinutes(config.workEnd);
  if (dayStart === null || dayEnd === null || dayStart >= dayEnd) return slots;

  let date = config.startDate;
  let guard = 0;
  while (date <= config.endDate) {
    let cursor = config.workStart;
    while (timeToMinutes(cursor) + config.duration <= dayEnd) {
      const endTime = addMinutes(cursor, config.duration);
      slots.push({ scheduledDate: date, startTime: cursor, endTime });
      cursor = addMinutes(endTime, config.buffer);
    }
    date = addDays(date, 1);
    guard += 1;
    if (guard > 370) break;
  }
  return slots;
}

function findAutoSchedulePlan(config) {
  const candidates = getAutoScheduleCandidates(config.musaedahName, config.jamiatName);
  const planned = [];
  const slots = buildAutoScheduleSlots(config);

  for (const candidate of candidates) {
    const slot = slots.find((item) => {
      const proposed = {
        ...candidate,
        scheduledDate: item.scheduledDate,
        startTime: item.startTime,
        endTime: item.endTime
      };
      const conflictsExisting = getScheduleConflict(proposed, candidate.id);
      const conflictsPlanned = planned.some((plan) => {
        const sameMusaedah = normalize(plan.musaedahName) === normalize(candidate.musaedahName);
        const sameDay = plan.scheduledDate === item.scheduledDate;
        const planStart = timeToMinutes(plan.startTime);
        const planEnd = timeToMinutes(plan.endTime);
        const slotStart = timeToMinutes(item.startTime);
        const slotEnd = timeToMinutes(item.endTime);
        return sameMusaedah && sameDay && slotStart < planEnd && planStart < slotEnd;
      });
      return !conflictsExisting && !conflictsPlanned;
    });
    if (!slot) break;
    planned.push({ id: candidate.id, musaedahName: candidate.musaedahName, ...slot });
  }

  return {
    totalCandidates: candidates.length,
    planned,
    unscheduled: Math.max(0, candidates.length - planned.length)
  };
}

function getAutoScheduleConfig() {
  return {
    musaedahName: $("autoMusaedahName").value === "All Musaedaat" ? ALL_MUSAEDAAT : $("autoMusaedahName").value,
    jamiatName: $("autoJamiatName").value,
    startDate: $("autoStartDate").value,
    endDate: $("autoEndDate").value,
    workStart: $("autoWorkStart").value,
    workEnd: $("autoWorkEnd").value,
    duration: Number($("autoDuration").value),
    buffer: Number($("autoBuffer").value)
  };
}

function canCreateCalendarEvent(record) {
  return Boolean(record.scheduledDate && record.startTime && record.endTime && !hasInvalidTimeWindow(record));
}

function googleDateTime(dateValue, timeValue) {
  return `${dateValue.replaceAll("-", "")}T${timeValue.replace(":", "")}00`;
}

function buildCalendarDetails(record) {
  return [
    `Jamiat: ${record.jamiat}`,
    `Jamaat / Mauze: ${record.jamaatMauze}`,
    `Being Handed By Zawjat of: ${record.handoverImaeFatemaName || record.handoverAmilName || "To be confirmed"}`,
    `Being Taken By Zawjat of: ${record.takeoverImaeFatemaName || record.takeoverAmilName || "To be confirmed"}`,
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

function openGoogleCalendar(record) {
  if (!canCreateCalendarEvent(record)) {
    showToast("Add date, start time and end time before creating a calendar event.");
    return;
  }
  window.open(buildGoogleCalendarUrl(record), "_blank", "noopener,noreferrer");
}

function formatMessage(record) {
  return `Baad al Salaam al Jazeel,

HOTO (Hand Over Take Over) has been scheduled for the following Mauze.

Jamiat: ${record.jamiat}
Jamaat / Mauze: ${record.jamaatMauze}
Being Handed By Zawjat of (Amilsaheb/Masool al Mawaaze): ${record.handoverImaeFatemaName || record.handoverAmilName || "To be confirmed"}
Being Taken By Zawjat of (Amilsaheb/Masool al Mawaaze): ${record.takeoverImaeFatemaName || record.takeoverAmilName || "To be confirmed"}
Date: ${formatDate(record.scheduledDate)}
Time: ${formatTimeRange(record)} (${record.timeZone})
Meeting Link: ${record.meetingLink || "To be shared"}

Please keep this message for reference.`;
}

function getFilteredSchedules() {
  const jamiat = $("jamiatFilter").value;
  const mauze = $("mauzeFilter").value.trim().toLowerCase();
  const musaedah = $("musaedahFilter").value;
  const date = $("dateFilter").value;
  const status = $("statusFilter").value;

  return schedules.filter((record) => {
    return (!jamiat || record.jamiat === jamiat)
      && (!mauze || record.jamaatMauze.toLowerCase().includes(mauze))
      && (!musaedah || record.musaedahName === musaedah)
      && (!date || record.scheduledDate === date)
      && (!status || record.status === status);
  });
}

function renderFilters() {
  const jamiatFilter = $("jamiatFilter");
  const musaedahFilter = $("musaedahFilter");
  const selectedJamiat = jamiatFilter.value;
  const selectedMusaedah = musaedahFilter.value;

  jamiatFilter.innerHTML = `<option value="">All Jamiats</option>${unique(schedules.map((record) => record.jamiat)).map((jamiat) => `<option>${escapeHtml(jamiat)}</option>`).join("")}`;
  musaedahFilter.innerHTML = `<option value="">All Musaedaat</option>${unique(schedules.map((record) => record.musaedahName)).map((name) => `<option>${escapeHtml(name)}</option>`).join("")}`;

  jamiatFilter.value = selectedJamiat;
  musaedahFilter.value = selectedMusaedah;
}

function renderYearSelector() {
  const yearSelect = $("yearSelect");
  const years = registerYear(activeYear);
  yearSelect.innerHTML = years.map((year) => `<option>${escapeHtml(year)}</option>`).join("");
  yearSelect.value = activeYear;
  $("activeYearLabel").textContent = activeYear;
  $("openParticipantLink").href = `imae-fatema.html?year=${encodeURIComponent(activeYear)}`;
}

function renderMetrics() {
  const today = new Date().toISOString().slice(0, 10);
  $("metricTotal").textContent = schedules.length;
  $("metricScheduled").textContent = schedules.filter((record) => record.status === "Scheduled").length;
  $("metricToday").textContent = schedules.filter((record) => record.scheduledDate === today).length;
  $("metricLinks").textContent = schedules.filter((record) => !record.meetingLink).length;
}

function getMusaedahStats() {
  const stats = new Map();
  schedules.forEach((record) => {
    const name = record.musaedahName || "Unassigned";
    if (!stats.has(name)) {
      stats.set(name, {
        name,
        total: 0,
        remaining: 0,
        draft: 0,
        scheduled: 0,
        completed: 0,
        cancelled: 0,
        missingLink: 0
      });
    }

    const item = stats.get(name);
    item.total += 1;
    if (record.status !== "Completed" && record.status !== "Cancelled") item.remaining += 1;
    if (record.status === "Draft") item.draft += 1;
    if (record.status === "Scheduled") item.scheduled += 1;
    if (record.status === "Completed") item.completed += 1;
    if (record.status === "Cancelled") item.cancelled += 1;
    if (!record.meetingLink) item.missingLink += 1;
  });

  return [...stats.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function renderMusaedahStats() {
  const selected = $("musaedahFilter").value;
  $("musaedahStatsRows").innerHTML = getMusaedahStats().map((item) => {
    const completion = item.total ? Math.round((item.completed / item.total) * 100) : 0;
    return `
      <tr class="${item.name === selected ? "selected" : ""}" data-action="filter-musaedah" data-name="${escapeAttribute(item.name)}" tabindex="0">
        <td>
          <span class="primary-cell">
            <strong>${escapeHtml(item.name)}</strong>
            <small>Click to view meetings</small>
          </span>
        </td>
        <td>${item.total}</td>
        <td>${item.remaining}</td>
        <td>${item.draft}</td>
        <td>${item.scheduled}</td>
        <td>${item.completed}</td>
        <td>${item.cancelled}</td>
        <td>${item.missingLink}</td>
        <td>
          <span class="completion-meter" aria-label="${completion}% completed">
            <span style="width:${completion}%"></span>
          </span>
          <span class="completion-text">${completion}%</span>
        </td>
        <td>
          <button class="btn btn-ghost" type="button" data-action="auto-schedule-musaedah" data-name="${escapeAttribute(item.name)}">Auto Schedule</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTable() {
  const rows = getFilteredSchedules();
  $("resultCount").textContent = `${rows.length} shown`;
  $("emptyTable").hidden = rows.length > 0;
  $("scheduleRows").innerHTML = rows.map((record, index) => `
    <tr>
      <td class="serial-cell">${escapeHtml(record.sourceSrNo || index + 1)}</td>
      <td>${escapeHtml(record.jamiat)}</td>
      <td>
        <span class="primary-cell">
          <strong>${escapeHtml(record.jamaatMauze)}</strong>
          <small>${escapeHtml(record.timeZone)}</small>
        </span>
      </td>
      <td>${escapeHtml(record.handoverImaeFatemaName || record.handoverAmilName)}</td>
      <td>${escapeHtml(record.takeoverImaeFatemaName || record.takeoverAmilName)}</td>
      <td>${escapeHtml(record.musaedahName)}</td>
      <td>${formatDate(record.scheduledDate)}</td>
      <td>${escapeHtml(formatTimeRange(record))}</td>
      <td>${record.meetingLink ? `<a class="link-pill" href="${escapeAttribute(record.meetingLink)}" target="_blank" rel="noreferrer">${escapeHtml(record.meetingLink)}</a>` : `<span class="muted">Missing</span>`}</td>
      <td><span class="badge ${record.status.toLowerCase()}">${escapeHtml(record.status)}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost" type="button" data-action="edit" data-id="${record.id}">Edit</button>
          <button class="btn btn-ghost" type="button" data-action="calendar" data-id="${record.id}" ${canCreateCalendarEvent(record) ? "" : "disabled"}>Add Calendar</button>
          <button class="btn btn-ghost" type="button" data-action="copy" data-id="${record.id}">Copy Message</button>
          <button class="btn btn-ghost" type="button" data-action="whatsapp" data-id="${record.id}">Open WhatsApp</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderParticipantCards() {
  const query = $("participantSearch").value.trim().toLowerCase();
  const rows = schedules.filter((record) => {
    const haystack = [
      record.jamiat,
      record.jamaatMauze,
      record.handoverImaeFatemaName,
      record.takeoverImaeFatemaName,
      record.musaedahName
    ].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  $("participantCards").innerHTML = rows.map((record) => `
    <article class="participant-card">
      <div class="card-top">
        <div>
          <p class="kicker">${escapeHtml(record.jamiat)}</p>
          <h3>${escapeHtml(record.jamaatMauze)}</h3>
        </div>
        <span class="badge ${record.status.toLowerCase()}">${escapeHtml(record.status)}</span>
      </div>
      <div class="meta-grid">
        <p><span>Being Handed By Zawjat of</span>${escapeHtml(record.handoverImaeFatemaName || record.handoverAmilName)}</p>
        <p><span>Being Taken By Zawjat of</span>${escapeHtml(record.takeoverImaeFatemaName || record.takeoverAmilName)}</p>
        <p><span>Date</span>${formatDate(record.scheduledDate)}</p>
        <p><span>Time</span>${escapeHtml(formatTimeRange(record))}</p>
      </div>
      <p class="instructions"><strong>Instructions:</strong> ${escapeHtml(record.instructions || "Please join on time.")}</p>
      <div class="participant-actions">
        ${record.meetingLink ? `<a class="btn btn-primary" href="${escapeAttribute(record.meetingLink)}" target="_blank" rel="noreferrer">Join Meeting</a>` : `<button class="btn btn-primary" type="button" disabled>Join Meeting</button>`}
        <button class="btn btn-secondary" type="button" data-action="calendar" data-id="${record.id}">Add Calendar</button>
      </div>
    </article>
  `).join("") || `
    <div class="empty-state">
      <img src="assets/da-motif.svg" alt="" />
      <strong>No HOTO records found.</strong>
      <span>Try another search.</span>
    </div>
  `;
}

function renderAll() {
  renderYearSelector();
  renderFilters();
  renderMetrics();
  renderMusaedahStats();
  renderTable();
  renderParticipantCards();
}

function clearScheduleFilters() {
  $("jamiatFilter").value = "";
  $("mauzeFilter").value = "";
  $("musaedahFilter").value = "";
  $("dateFilter").value = "";
  $("statusFilter").value = "";
  renderMusaedahStats();
  renderTable();
}

function openDrawer(record) {
  activeRecordId = record.id;
  $("drawerMode").textContent = record.id.startsWith("new-") ? "New HOTO" : "Edit Schedule";
  $("drawerTitle").textContent = record.id.startsWith("new-") ? "Add HOTO" : "Edit Schedule";
  $("recordId").value = record.id;
  $("jamiatInput").value = record.jamiat;
  $("mauzeInput").value = record.jamaatMauze;
  $("handoverInput").value = record.handoverImaeFatemaName;
  $("takeoverInput").value = record.takeoverImaeFatemaName;
  $("handoverAmilInput").value = record.handoverAmilName;
  $("takeoverAmilInput").value = record.takeoverAmilName;
  $("musaedahInput").value = record.musaedahName;
  $("dateInput").value = record.scheduledDate;
  $("startInput").value = record.startTime;
  $("endInput").value = record.endTime;
  $("timezoneInput").value = record.timeZone;
  $("statusInput").value = record.status;
  $("linkInput").value = record.meetingLink;
  $("instructionsInput").value = record.instructions;
  updateMessagePreview();

  $("drawerBackdrop").hidden = false;
  $("editDrawer").classList.add("open");
  $("editDrawer").setAttribute("aria-hidden", "false");
  $("dateInput").focus();
}

function closeDrawer() {
  $("drawerBackdrop").hidden = true;
  $("editDrawer").classList.remove("open");
  $("editDrawer").setAttribute("aria-hidden", "true");
  activeRecordId = "";
}

function getJamiatsForMusaedah(musaedahName) {
  return unique(schedules
    .filter((record) => normalize(record.musaedahName) === normalize(musaedahName))
    .map((record) => record.jamiat));
}

function openAutoScheduleDialog(musaedahName) {
  if (!musaedahName) {
    showToast("Choose Auto Schedule from a Musaedah row.");
    return;
  }
  const jamiats = getJamiatsForMusaedah(musaedahName);
  if (!jamiats.length) {
    showToast("No Jamiats found for this Musaedah.");
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const currentJamiat = $("jamiatFilter").value;
  $("autoMusaedahName").value = musaedahName;
  $("autoJamiatName").innerHTML = jamiats.map((jamiat) => `<option>${escapeHtml(jamiat)}</option>`).join("");
  $("autoJamiatName").value = jamiats.includes(currentJamiat) ? currentJamiat : jamiats[0];
  $("autoScheduleCopy").textContent = "This will schedule only the selected Musaedah and selected Jamiat. Other Jamiats will not be touched.";
  openAutoScheduleModal(today);
}

function openSuperAdminJamiatScheduleDialog() {
  const today = new Date().toISOString().slice(0, 10);
  const jamiats = unique(schedules.map((record) => record.jamiat));
  const currentJamiat = $("jamiatFilter").value;
  $("autoMusaedahName").value = "All Musaedaat";
  $("autoJamiatName").innerHTML = jamiats.map((jamiat) => `<option>${escapeHtml(jamiat)}</option>`).join("");
  $("autoJamiatName").value = jamiats.includes(currentJamiat) ? currentJamiat : jamiats[0];
  $("autoScheduleCopy").textContent = "Super Admin mode: this will schedule Draft or unscheduled meetings for the selected Jamiat across all Musaedaat. Other Jamiats will not be touched.";
  openAutoScheduleModal(today);
}

function openAutoScheduleModal(today) {
  $("autoStartDate").value = $("autoStartDate").value || today;
  $("autoEndDate").value = $("autoEndDate").value || addDays(today, 4);
  $("autoScheduleBackdrop").hidden = false;
  $("autoScheduleDialog").classList.add("open");
  $("autoScheduleDialog").setAttribute("aria-hidden", "false");
  $("autoStartDate").focus();
}

function closeAutoScheduleDialog() {
  $("autoScheduleBackdrop").hidden = true;
  $("autoScheduleDialog").classList.remove("open");
  $("autoScheduleDialog").setAttribute("aria-hidden", "true");
}

function validateAutoScheduleConfig(config) {
  if (!config.musaedahName) return "Choose Auto Schedule from a Musaedah row.";
  if (!config.jamiatName) return "Choose one Jamiat to schedule.";
  if (!config.startDate || !config.endDate) return "Choose start and end dates.";
  if (config.startDate > config.endDate) return "End date must be after start date.";
  if (timeToMinutes(config.workStart) >= timeToMinutes(config.workEnd)) return "Work end time must be after start time.";
  if (!config.duration || config.duration < 5) return "Choose a valid meeting duration.";
  return "";
}

function describeAutoScheduleScope(config) {
  return config.musaedahName === ALL_MUSAEDAAT
    ? `${config.jamiatName} across all Musaedaat`
    : `${config.jamiatName} for ${config.musaedahName}`;
}

function getRecordFromForm() {
  return {
    id: $("recordId").value || `new-${Date.now()}`,
    jamiat: $("jamiatInput").value.trim(),
    jamaatMauze: $("mauzeInput").value.trim(),
    handoverImaeFatemaName: $("handoverInput").value.trim(),
    takeoverImaeFatemaName: $("takeoverInput").value.trim(),
    handoverAmilName: $("handoverAmilInput").value.trim(),
    takeoverAmilName: $("takeoverAmilInput").value.trim(),
    musaedahName: $("musaedahInput").value.trim(),
    scheduledDate: $("dateInput").value,
    startTime: $("startInput").value,
    endTime: $("endInput").value,
    timeZone: $("timezoneInput").value.trim(),
    meetingLink: $("linkInput").value.trim(),
    instructions: $("instructionsInput").value.trim(),
    status: $("statusInput").value,
    lastMessageSentAt: "",
    lastUpdatedBy: "Musaedah",
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getRowValue(row, aliases) {
  const normalized = new Map(Object.keys(row).map((key) => [normalizeHeader(key), row[key]]));
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function parseImportedDate(value) {
  if (!value) return "";
  if (typeof value === "number" && window.XLSX?.SSF) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return "";
}

function parseImportedTime(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function mapImportedRow(row, index, year, importedAt, sourceName) {
  const sourceSrNo = getRowValue(row, ["Sr. No.", "Sr No", "Serial", "Serial Number", "No"]);
  const jamiat = getRowValue(row, ["Jamiat"]);
  const jamaatMauze = getRowValue(row, ["Jamaat / Mauze", "Jamaat/Mauze", "Jamaat", "Mauze", "Jamaat Mauze"]);
  const handover = getRowValue(row, [
    "Being Handed By",
    "Being Handed By Zawjat of",
    "Handed By",
    "Handing Imae Fatema",
    "Handover Imae Fatema",
    "Handing Amil"
  ]);
  const takeover = getRowValue(row, [
    "Being Taken By",
    "Being Taken By Zawjat of",
    "Taken By",
    "Taking Imae Fatema",
    "Takeover Imae Fatema",
    "Taking Amil"
  ]);
  const musaedah = getRowValue(row, ["Musaedah", "Musaeda", "Musaedah DA", "Musaeda DA"]);
  const scheduledDate = parseImportedDate(row.Date || row.date || getRowValue(row, ["Date", "Schedule Date", "Scheduled Date"]));
  const startTime = parseImportedTime(row["Start Time"] || row.startTime || getRowValue(row, ["Start Time", "Time Start"]));
  const endTime = parseImportedTime(row["End Time"] || row.endTime || getRowValue(row, ["End Time", "Time End"]));
  const meetingLink = getRowValue(row, ["Google Meet Link", "Meeting Link", "Meet Link", "Link"]);
  const status = getRowValue(row, ["Status"]) || (scheduledDate && startTime && endTime ? "Scheduled" : "Draft");

  if (!jamiat && !jamaatMauze && !handover && !takeover && !musaedah) return null;

  return {
    id: `hoto-${normalizeYear(year).toLowerCase()}-${String(index + 1).padStart(3, "0")}`,
    sourceSrNo: Number(sourceSrNo) || index + 1,
    jamiat,
    jamaatMauze,
    handoverImaeFatemaName: handover,
    takeoverImaeFatemaName: takeover,
    handoverAmilName: handover,
    takeoverAmilName: takeover,
    musaedahName: musaedah,
    scheduledDate,
    startTime,
    endTime,
    timeZone: getRowValue(row, ["Time Zone", "Timezone"]) || "Asia/Kolkata",
    meetingLink,
    instructions: getRowValue(row, ["Instructions"]) || "Please update the schedule date, time and meeting link before sending the WhatsApp message.",
    status,
    remarks: getRowValue(row, ["Remarks", "Notes"]),
    sourceFileName: sourceName,
    lastMessageSentAt: "",
    lastUpdatedBy: "Excel import",
    lastUpdatedAt: importedAt
  };
}

async function importYearFromFile(year, file) {
  if (!window.XLSX) throw new Error("Excel import library did not load. Please connect to the internet and refresh once.");
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  const importedAt = new Date().toISOString();
  const records = rows
    .map((row, index) => mapImportedRow(row, index, year, importedAt, file.name))
    .filter(Boolean);
  if (!records.length) throw new Error("No HOTO rows were found in this file.");
  return records;
}

function openImportYearDialog() {
  $("importYearInput").value = "";
  $("importFileInput").value = "";
  $("importYearBackdrop").hidden = false;
  $("importYearDialog").classList.add("open");
  $("importYearDialog").setAttribute("aria-hidden", "false");
  $("importYearInput").focus();
}

function closeImportYearDialog() {
  $("importYearBackdrop").hidden = true;
  $("importYearDialog").classList.remove("open");
  $("importYearDialog").setAttribute("aria-hidden", "true");
}

function updateMessagePreview() {
  const record = getRecordFromForm();
  const conflict = getScheduleConflict(record, record.id);
  $("messagePreview").textContent = formatMessage(record);
  $("conflictWarning").hidden = !conflict && !hasInvalidTimeWindow(record);
  $("conflictWarning").textContent = hasInvalidTimeWindow(record)
    ? "End time must be after start time."
    : conflict ? getConflictMessage(record, conflict) : "";
}

async function copyMessage(record) {
  const message = formatMessage(record);
  try {
    await navigator.clipboard.writeText(message);
    showToast("WhatsApp message copied.");
  } catch {
    showToast("Copy failed. Select the message preview and copy manually.");
  }
}

function openWhatsApp(record) {
  const url = `https://wa.me/?text=${encodeURIComponent(formatMessage(record))}`;
  window.open(url, "_blank", "noopener,noreferrer");
  record.lastMessageSentAt = new Date().toISOString();
  saveSchedules();
  renderAll();
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

function setRoute() {
  const participant = location.hash === "#/hoto/imae-fatema";
  $("dashboard-view").hidden = participant;
  $("participant-view").hidden = !participant;
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", (participant && link.dataset.route === "participant") || (!participant && link.dataset.route === "dashboard"));
  });
}

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  if (actionButton.dataset.action === "auto-schedule-musaedah") {
    event.stopPropagation();
    $("musaedahFilter").value = actionButton.dataset.name;
    $("jamiatFilter").value = "";
    $("mauzeFilter").value = "";
    $("dateFilter").value = "";
    $("statusFilter").value = "";
    renderMusaedahStats();
    renderTable();
    openAutoScheduleDialog(actionButton.dataset.name);
    return;
  }
  if (actionButton.dataset.action === "filter-musaedah") {
    $("musaedahFilter").value = actionButton.dataset.name;
    $("jamiatFilter").value = "";
    $("mauzeFilter").value = "";
    $("dateFilter").value = "";
    $("statusFilter").value = "";
    renderMusaedahStats();
    renderTable();
    showToast(`Showing meetings for ${actionButton.dataset.name}.`);
    return;
  }

  const record = schedules.find((item) => item.id === actionButton.dataset.id);
  if (!record) return;

  if (actionButton.dataset.action === "edit") openDrawer(record);
  if (actionButton.dataset.action === "calendar") openGoogleCalendar(record);
  if (actionButton.dataset.action === "copy") copyMessage(record);
  if (actionButton.dataset.action === "whatsapp") openWhatsApp(record);
});

["jamiatFilter", "mauzeFilter", "musaedahFilter", "dateFilter", "statusFilter"].forEach((id) => {
  $(id).addEventListener("input", () => {
    renderMusaedahStats();
    renderTable();
  });
});

$("musaedahStatsRows").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-action='filter-musaedah']");
  if (!row) return;
  event.preventDefault();
  row.click();
});

$("participantSearch").addEventListener("input", renderParticipantCards);
$("closeDrawer").addEventListener("click", closeDrawer);
$("drawerBackdrop").addEventListener("click", closeDrawer);
$("closeAutoSchedule").addEventListener("click", closeAutoScheduleDialog);
$("autoScheduleBackdrop").addEventListener("click", closeAutoScheduleDialog);
$("importYearBackdrop").addEventListener("click", closeImportYearDialog);
$("closeImportYear").addEventListener("click", closeImportYearDialog);
$("cancelImportYear").addEventListener("click", closeImportYearDialog);
$("clearMusaedahStatsFilter").addEventListener("click", () => {
  clearScheduleFilters();
  showToast("Showing all HOTO records.");
});

$("clearEmptyFilters").addEventListener("click", () => {
  clearScheduleFilters();
  showToast("Filters cleared.");
});

$("yearSelect").addEventListener("change", async () => {
  saveActiveYear($("yearSelect").value);
  schedules = loadSchedules(activeYear);
  clearScheduleFilters();
  renderAll();
  if (databaseMode === "teable") {
    try {
      const data = await apiRequest(`/api/schedules?year=${encodeURIComponent(activeYear)}`);
      if (Array.isArray(data.records)) {
        schedules = data.records.length ? data.records : getDefaultSchedulesForYear(activeYear);
        localStorage.setItem(getScheduleStorageKey(activeYear), JSON.stringify(schedules));
        renderAll();
      }
    } catch (error) {
      showToast(error.message || "Could not load this year from Teable.");
      return;
    }
  }
  showToast(`Showing ${activeYear} HOTO schedule.`);
});

$("newRowBtn").addEventListener("click", () => {
  openDrawer({
    id: `new-${Date.now()}`,
    jamiat: "",
    jamaatMauze: "",
    handoverImaeFatemaName: "",
    takeoverImaeFatemaName: "",
    handoverAmilName: "",
    takeoverAmilName: "",
    musaedahName: "",
    scheduledDate: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: "10:45",
    timeZone: "Asia/Kolkata",
    meetingLink: "",
    instructions: "Please join five minutes early and keep HOTO notes ready.",
    status: "Draft"
  });
});

$("resetDemo").addEventListener("click", () => {
  schedules = getDefaultSchedulesForYear(activeYear);
  saveSchedules();
  renderAll();
  showToast(`${activeYear} HOTO schedule data reset.`);
});

$("unlockSuperAdmin").addEventListener("click", () => {
  const passcode = window.prompt("Enter Super Admin passcode");
  if (passcode !== SUPER_ADMIN_PASSCODE) {
    showToast("Super Admin access denied.");
    return;
  }
  $("superAdminControls").hidden = false;
  $("unlockSuperAdmin").hidden = true;
  showToast("Super Admin controls unlocked.");
});

$("openImportYear").addEventListener("click", openImportYearDialog);
$("scheduleJamiatSuperAdmin").addEventListener("click", openSuperAdminJamiatScheduleDialog);

$("importYearForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const year = normalizeYear($("importYearInput").value);
  const file = $("importFileInput").files[0];
  if (!year || !file) {
    showToast("Choose a Hijri year and Excel file.");
    return;
  }
  const existing = localStorage.getItem(getScheduleStorageKey(year));
  if (existing && !window.confirm(`${year} already has saved HOTO data. Replace it with this import?`)) return;
  try {
    const imported = await importYearFromFile(year, file);
    saveActiveYear(year);
    schedules = imported;
    saveSchedules();
    clearScheduleFilters();
    renderAll();
    closeImportYearDialog();
    showToast(`${year} imported with ${imported.length} HOTO rows.`);
  } catch (error) {
    showToast(error.message || "Could not import this file.");
  }
});

$("scheduleForm").addEventListener("input", updateMessagePreview);
$("scheduleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const next = getRecordFromForm();
  if (hasInvalidTimeWindow(next)) {
    updateMessagePreview();
    showToast("End time must be after start time.");
    return;
  }
  const conflict = getScheduleConflict(next, next.id);
  if (conflict) {
    updateMessagePreview();
    showToast("This Musaedah already has HOTO in that time frame.");
    return;
  }
  const existingIndex = schedules.findIndex((record) => record.id === next.id);
  if (existingIndex >= 0) {
    schedules[existingIndex] = { ...schedules[existingIndex], ...next };
  } else {
    schedules = [next, ...schedules];
  }
  saveSchedules();
  renderAll();
  closeDrawer();
  showToast("HOTO schedule saved.");
});

$("copyFromDrawer").addEventListener("click", () => copyMessage(getRecordFromForm()));
$("whatsappFromDrawer").addEventListener("click", () => openWhatsApp(getRecordFromForm()));
$("calendarFromDrawer").addEventListener("click", () => openGoogleCalendar(getRecordFromForm()));

$("previewAutoSchedule").addEventListener("click", () => {
  const config = getAutoScheduleConfig();
  const error = validateAutoScheduleConfig(config);
  if (error) {
    showToast(error);
    return;
  }
  const plan = findAutoSchedulePlan(config);
  showToast(`${describeAutoScheduleScope(config)}: ${plan.planned.length} of ${plan.totalCandidates} meetings can be scheduled. ${plan.unscheduled} will remain unscheduled.`);
});

$("autoScheduleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const config = getAutoScheduleConfig();
  const error = validateAutoScheduleConfig(config);
  if (error) {
    showToast(error);
    return;
  }
  const plan = findAutoSchedulePlan(config);
  if (!plan.planned.length) {
    showToast("No draft meetings could be scheduled in that window.");
    return;
  }

  const plannedById = new Map(plan.planned.map((item) => [item.id, item]));
  schedules = schedules.map((record) => {
    const planned = plannedById.get(record.id);
    if (!planned) return record;
    return {
      ...record,
      scheduledDate: planned.scheduledDate,
      startTime: planned.startTime,
      endTime: planned.endTime,
      status: "Scheduled",
      lastUpdatedBy: "Auto Schedule",
      lastUpdatedAt: new Date().toISOString()
    };
  });

  saveSchedules();
  renderAll();
  closeAutoScheduleDialog();
  showToast(`${describeAutoScheduleScope(config)}: scheduled ${plan.planned.length} meetings. ${plan.unscheduled} remain unscheduled.`);
});

$("copyParticipantLink").addEventListener("click", async () => {
  const link = new URL(`imae-fatema.html?year=${encodeURIComponent(activeYear)}`, window.location.href).href;
  try {
    await navigator.clipboard.writeText(link);
    showToast("Imae Fatema view link copied.");
  } catch {
    showToast(link);
  }
});

window.addEventListener("hashchange", setRoute);
setRoute();
renderAll();
hydrateFromServer();
