export function sanitizeInput(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/[^0-9.,]/g, "");
}

export function normalizeDecimal(s: string): string {
  let x = sanitizeInput(s);
  if (!x) return "";

  x = x.replace(/,/g, "");

  const firstDot = x.indexOf(".");
  if (firstDot !== -1) {
    const intPart = x.slice(0, firstDot);
    const decimalPart = x.slice(firstDot + 1).replace(/\./g, "");
    return decimalPart ? `${intPart}.${decimalPart}` : intPart;
  }

  return x;
}

export function limitDecimals(x: string, max = 2): string {
  const [i, d] = x.split(".");
  if (!d) return i;
  return `${i}.${d.slice(0, max)}`;
}

export function stripLeadingZerosInt(i: string): string {
  const trimmed = i.replace(/^0+(?=\d)/, "");
  return trimmed === "" ? "0" : trimmed;
}

export function addGrouping(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function toDisplay(raw: string, maxDecimals: number): string {
  if (!raw) return "";
  const normalized = limitDecimals(normalizeDecimal(raw), maxDecimals);
  const [i, d] = normalized.split(".");
  const intPart = addGrouping(stripLeadingZerosInt(i || "0"));
  return d != null ? `${intPart}.${d}` : intPart;
}

export function toRaw(display: string, maxDecimals: number): string {
  if (!display) return "";
  const normalized = limitDecimals(normalizeDecimal(display), maxDecimals);
  return normalized;
}

export function isValidNumberString(v: string): boolean {
  return v === "" || /^(\d+(\.\d+)?)$/.test(v);
}
