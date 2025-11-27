export function sanitizeInput(s: string): string {
  if (!s) return "";
  return s.replace(/[^\d.,]/g, "");
}

export function normalizeDecimalFlexible(s: string): string {
  let x = sanitizeInput(s);
  if (!x) return "";

  x = x.replace(/,/g, "");

  const parts = x.split(".");

  if (parts.length > 2) {
    const intPart = parts.shift() || "";
    const decPart = parts.join("");
    return intPart + "." + decPart;
  }

  return x;
}

export function limitDecimals(raw: string, maxDecimals: number): string {
  if (!raw) return "";

  const [int, dec = ""] = raw.split(".");
  const trimmed = dec.slice(0, maxDecimals);

  return trimmed ? `${int}.${trimmed}` : int;
}

export function toDisplayUS(input: string, maxDecimals = 8): string {
  if (!input) return "";

  const normalized = normalizeDecimalFlexible(input);
  let [intPart, dec = ""] = normalized.split(".");

  intPart = intPart.replace(/^0+(?=\d)/, "") || "0";

  dec = dec.slice(0, maxDecimals);

  const withGrouping = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return dec ? `${withGrouping}.${dec}` : withGrouping;
}

export function toRawNeutral(display: string, maxDecimals = 8): string {
  const sanitized = sanitizeInput(display);
  if (!sanitized) return "";

  const noCommas = sanitized.replace(/,/g, "");
  const endsWithDot = noCommas.endsWith(".");
  const parts = noCommas.split(".");

  if (endsWithDot && parts.length === 2 && parts[1] === "") {
    const intRaw = parts[0];

    const intNorm =
      intRaw === "" ? "0" : intRaw.replace(/^0+(?=\d)/, "") || "0";

    return intNorm + ".";
  }

  const normalized = normalizeDecimalFlexible(noCommas);
  return limitDecimals(normalized, maxDecimals);
}

export function isValidNeutral(v: string): boolean {
  if (v === "" || v === ".") return true;

  const norm = normalizeDecimalFlexible(v);

  if (norm.endsWith(".")) {
    return /^\d+$/.test(norm.slice(0, -1));
  }

  return /^(\d+(\.\d+)?)$/.test(norm);
}

export function toDisplay(input: string, maxDecimals = 8): string {
  return toDisplayUS(input, maxDecimals);
}

export default toDisplayUS;
