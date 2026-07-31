export function normalizeValue(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function hasUsableTimeWindow(record) {
  return Boolean(record.scheduledDate && record.startTime && record.endTime);
}

export function hasInvalidTimeWindow(record) {
  if (!record.startTime || !record.endTime) return false;
  const start = timeToMinutes(record.startTime);
  const end = timeToMinutes(record.endTime);
  return start !== null && end !== null && start >= end;
}

export function getHandoverPerson(record) {
  return record.handoverImaeFatemaName || record.handoverAmilName || "";
}

export function getTakeoverPerson(record) {
  return record.takeoverImaeFatemaName || record.takeoverAmilName || "";
}

export function getMeetingPeople(record) {
  return [getHandoverPerson(record), getTakeoverPerson(record)]
    .map(normalizeValue)
    .filter(Boolean);
}

export function getMeetingPersonName(record, normalizedPerson) {
  return [getHandoverPerson(record), getTakeoverPerson(record)]
    .find((person) => normalizeValue(person) === normalizedPerson) || "This person";
}

export function schedulesOverlap(left, right) {
  const leftStart = timeToMinutes(left.startTime);
  const leftEnd = timeToMinutes(left.endTime);
  const rightStart = timeToMinutes(right.startTime);
  const rightEnd = timeToMinutes(right.endTime);
  if ([leftStart, leftEnd, rightStart, rightEnd].some((value) => value === null)) return false;
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function findScheduleConflict(candidate, records, ignoreId = "") {
  if (!hasUsableTimeWindow(candidate) || hasInvalidTimeWindow(candidate)) return null;
  const candidateMusaedah = normalizeValue(candidate.musaedahName);
  const candidatePeople = getMeetingPeople(candidate);

  const conflict = records.find((record) => {
    if (record.id === ignoreId || record.teableRecordId === ignoreId) return false;
    if (record.status === "Cancelled") return false;
    if (!hasUsableTimeWindow(record)) return false;
    if (record.scheduledDate !== candidate.scheduledDate) return false;
    if (!schedulesOverlap(candidate, record)) return false;

    const sameMusaedah = candidateMusaedah && normalizeValue(record.musaedahName) === candidateMusaedah;
    const recordPeople = new Set(getMeetingPeople(record));
    const samePerson = candidatePeople.some((person) => recordPeople.has(person));
    return sameMusaedah || samePerson;
  });

  if (!conflict) return null;
  const conflictPeople = new Set(getMeetingPeople(conflict));
  const matchingPerson = candidatePeople.find((person) => conflictPeople.has(person));
  return {
    type: matchingPerson ? "person" : "musaedah",
    person: matchingPerson ? getMeetingPersonName(candidate, matchingPerson) : "",
    record: conflict
  };
}

export function getConflictMessage(candidate, conflict) {
  const record = conflict.record;
  const date = record.scheduledDate || "the selected date";
  const time = record.startTime && record.endTime ? `${record.startTime} - ${record.endTime}` : "the selected time";
  if (conflict.type === "person") {
    const person = conflict.person || "This person";
    return `${person} is already scheduled for ${record.jamaatMauze}, ${record.jamiat} on ${date} from ${time}. Choose another time.`;
  }
  return `${candidate.musaedahName} already has HOTO for ${record.jamaatMauze}, ${record.jamiat} on ${date} from ${time}. Choose another time.`;
}

export function validateScheduleBatch(records) {
  const scheduled = records.filter((record) => record.status !== "Cancelled" && hasUsableTimeWindow(record));
  for (const record of scheduled) {
    if (hasInvalidTimeWindow(record)) {
      return { valid: false, message: "End time must be after start time." };
    }
    const conflict = findScheduleConflict(record, scheduled, record.id);
    if (conflict) {
      return { valid: false, message: getConflictMessage(record, conflict) };
    }
  }
  return { valid: true, message: "" };
}
