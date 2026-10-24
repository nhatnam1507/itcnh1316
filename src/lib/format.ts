/** `1998-03-14` → `14/03/1998` (Vietnamese day-first order). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Day-first input to ISO: `14/03/1998`, `14-3-1998`, `14.03.1998` and `14031998` all give
 * `1998-03-14`; an ISO date passes through. Returns null for anything else. Whether the
 * date exists (30 February) is left to validation.
 */
export function parseDayFirstDate(input: string): string | null {
  const text = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function ageOn(isoDate: string, today: Date = new Date()): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** `+84912345678` → `+84 912 345 678`. */
export function formatPhone(phone: string): string {
  const match = /^\+84(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return match ? `+84 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

export function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(isoTimestamp));
}
