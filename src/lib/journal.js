// src/lib/journal.js
// Lightweight journal stored in localStorage so Row 7 can show entries.
// Safe no-ops if localStorage is unavailable.

const KEY = "frye_journal_v1";

export function getJournalEntries() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addJournalEntry(entry) {
  try {
    const arr = getJournalEntries();
    arr.unshift({
      id: `${Date.now()}-${Math.random()}`,
      ...entry,
    });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 500)));
    }
  } catch {
    // no-op
  }
}

export function clearJournal() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(KEY);
    }
  } catch {
    // no-op
  }
}
