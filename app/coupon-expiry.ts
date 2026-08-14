const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function isoDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month || value.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function capturedDate(value?: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

export function parseCouponExpiryDate(value?: string | null, capturedAt?: string | null) {
  if (!value) return null;
  const text = value.toLocaleLowerCase("en-IE").replace(/[,]/g, " ").replace(/\s+/g, " ").trim();

  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|20\d{2})\b/);
  if (numeric) {
    const year = Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return isoDate(year, Number(numeric[2]), Number(numeric[1]));
  }

  const named = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)(?:[a-z]*)?(?:\s+(20\d{2}|\d{2}))?\b/)
    ?? text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)(?:[a-z]*)?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(20\d{2}|\d{2}))?\b/);
  if (!named) return null;

  const monthFirst = Number.isNaN(Number(named[1]));
  const month = MONTHS[(monthFirst ? named[1] : named[2]).slice(0, 4)] ?? MONTHS[(monthFirst ? named[1] : named[2]).slice(0, 3)];
  const day = Number(monthFirst ? named[2] : named[1]);
  const yearText = named[3];
  const captured = capturedDate(capturedAt);
  let year = yearText ? Number(yearText) : (captured?.year ?? new Date().getUTCFullYear());
  if (year < 100) year += 2000;
  if (!yearText && captured?.month === 12 && month === 1) year += 1;
  return isoDate(year, month, day);
}

export function dublinDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isCouponExpired(expiresText?: string | null, capturedAt?: string | null, today = dublinDate()) {
  const expiryDate = parseCouponExpiryDate(expiresText, capturedAt);
  return expiryDate !== null && expiryDate < today;
}
