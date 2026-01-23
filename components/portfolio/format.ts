export function usd(n: number | null | undefined) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function pct(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function qty(n: number | null | undefined, digits = 8) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toFixed(digits).replace(/\.?0+$/, "");
}

export function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
