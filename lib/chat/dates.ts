export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeDateString(dateStr: string): string {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/;
  const ymdMatch = dateStr.match(ymd);
  if (ymdMatch) return dateStr;
  const dmyMatch = dateStr.match(dmy);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

export function toComparableDateValue(dateStr: string): number {
  const normalized = normalizeDateString(dateStr);
  const value = new Date(normalized).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function toDateFormat(dateStr: string): string {
  const normalized = normalizeDateString(dateStr);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

export function toReadableDate(dateStr: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const normalized = normalizeDateString(dateStr);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const day = parseInt(match[3], 10);
    const monthIdx = parseInt(match[2], 10) - 1;
    return `${String(day).padStart(2, "0")} ${months[monthIdx]} ${match[1]}`;
  }
  return dateStr;
}
