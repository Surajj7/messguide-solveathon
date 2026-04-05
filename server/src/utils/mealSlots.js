/**
 * Fixed meal windows (local server time).
 * Breakfast 7:00–9:00, Lunch 12:00–14:00, Snacks 17:00–18:30, Dinner 19:00–21:00
 */

export const ATTENDANCE_MEALS = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

const WINDOWS = {
  BREAKFAST: { start: 7 * 60, end: 9 * 60 },
  LUNCH: { start: 12 * 60, end: 14 * 60 },
  SNACKS: { start: 17 * 60, end: 17 * 60 + 90 },
  DINNER: { start: 19 * 60, end: 21 * 60 },
};

const ORDER = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

function toMinutes(d) {
  return d.getHours() * 60 + d.getMinutes();
}

/** @param {Date} [now] */
export function getCurrentMeal(now = new Date()) {
  const m = toMinutes(now);
  for (const slot of ORDER) {
    const w = WINDOWS[slot];
    if (m >= w.start && m < w.end) return slot;
  }
  return null;
}

/**
 * @param {Date} now
 * @returns {{ slot: string | null, phase: 'before'|'during'|'after'|'between', minutesToEnd: number | null, minutesFromStart: number | null }}
 */
export function getMealStatus(now = new Date()) {
  const m = toMinutes(now);
  let prevEnd = 0;
  for (let i = 0; i < ORDER.length; i++) {
    const slot = ORDER[i];
    const w = WINDOWS[slot];
    if (m < w.start) {
      return {
        slot: null,
        phase: i === 0 && m < w.start ? "before" : "between",
        minutesToEnd: null,
        minutesFromStart: w.start - m,
        nextMeal: slot,
      };
    }
    if (m >= w.start && m < w.end) {
      return {
        slot,
        phase: "during",
        minutesToEnd: w.end - m,
        minutesFromStart: m - w.start,
        nextMeal: null,
      };
    }
    prevEnd = w.end;
  }
  return {
    slot: null,
    phase: "after",
    minutesToEnd: null,
    minutesFromStart: null,
    nextMeal: null,
  };
}

export function getWindow(slot) {
  return WINDOWS[slot] || null;
}

/** True if OTP can be generated (during window or up to `earlyMins` before start). */
export function canGenerateOtpForSlot(slot, now = new Date(), earlyMins = 10) {
  const w = WINDOWS[slot];
  if (!w) return false;
  const mins = toMinutes(now);
  return mins >= w.start - earlyMins && mins < w.end;
}

/** Meal has fully ended for `date` (calendar day) at `now`. */
export function hasMealEnded(slot, date, now = new Date()) {
  const w = WINDOWS[slot];
  if (!w) return false;
  const d0 = new Date(date);
  d0.setHours(0, 0, 0, 0);
  const end = new Date(d0);
  end.setHours(Math.floor(w.end / 60), w.end % 60, 0, 0);
  return now.getTime() >= end.getTime();
}

/** @param {Date} date */
export function dateKeyUTC(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function mealOrderIndex(slot) {
  return ORDER.indexOf(slot);
}
