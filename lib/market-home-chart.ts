import "server-only";

export type MarketCapChartPoint = {
  timestamp: number;
  value: number;
};

let fontsReady = false;

function formatCapCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(0)}B`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export async function generateMarketCapChartPng(
  points: MarketCapChartPoint[],
): Promise<Buffer> {
  const { createCanvas, GlobalFonts } = await import("@napi-rs/canvas");

  if (!fontsReady) {
    try {
      const root = process.cwd();
      GlobalFonts.registerFromPath(`${root}/public/fonts/Inter-Regular.ttf`, "Inter");
      GlobalFonts.registerFromPath(`${root}/public/fonts/Inter-Bold.ttf`, "Inter Bold");
    } catch {
      // ignore missing font files
    } finally {
      fontsReady = true;
    }
  }

  const family = GlobalFonts.has("Inter") ? "Inter" : "sans-serif";
  const familyBold = GlobalFonts.has("Inter Bold") ? "Inter Bold" : family;

  const width = 1200;
  const height = 640;
  const paddingX = 72;
  const paddingTop = 68;
  const paddingBottom = 78;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "middle";

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#FFFFFF");
  gradient.addColorStop(1, "#F9F6FF");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#14121A";
  ctx.font = `bold 22px ${familyBold}`;
  ctx.fillText("TOTAL Crypto Market Cap", paddingX, 34);

  ctx.fillStyle = "#6B6777";
  ctx.font = `13px ${family}`;
  ctx.fillText("Daily snapshot series used for Home Page AI analysis", paddingX, 56);

  const safePoints =
    points.length >= 2
      ? points
      : [
          { timestamp: Date.now() - 86_400_000, value: points[0]?.value ?? 0 },
          { timestamp: Date.now(), value: points[0]?.value ?? 0 },
        ];

  const values = safePoints.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = Math.max(maxValue - minValue, maxValue * 0.04, 1);
  const chartMin = Math.max(0, minValue - spread * 0.18);
  const chartMax = maxValue + spread * 0.18;
  const range = Math.max(1, chartMax - chartMin);

  ctx.strokeStyle = "#ECE8F6";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = paddingTop + (plotHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingX, y);
    ctx.lineTo(paddingX + plotWidth, y);
    ctx.stroke();

    const labelValue = chartMax - (range / 4) * i;
    ctx.fillStyle = "#7C748F";
    ctx.font = `12px ${family}`;
    ctx.fillText(formatCapCompact(labelValue), paddingX, y - 16);
  }

  const coords = safePoints.map((point, index) => {
    const x =
      paddingX +
      (safePoints.length === 1 ? 0 : (plotWidth * index) / (safePoints.length - 1));
    const y =
      paddingTop + ((chartMax - point.value) / range) * plotHeight;
    return { x, y, point };
  });

  const area = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + plotHeight);
  area.addColorStop(0, "rgba(124,58,237,0.24)");
  area.addColorStop(1, "rgba(124,58,237,0.03)");

  ctx.beginPath();
  ctx.moveTo(coords[0].x, paddingTop + plotHeight);
  for (const coord of coords) ctx.lineTo(coord.x, coord.y);
  ctx.lineTo(coords[coords.length - 1].x, paddingTop + plotHeight);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();

  ctx.beginPath();
  for (const [index, coord] of coords.entries()) {
    if (index === 0) ctx.moveTo(coord.x, coord.y);
    else ctx.lineTo(coord.x, coord.y);
  }
  ctx.strokeStyle = "#7C3AED";
  ctx.lineWidth = 4;
  ctx.stroke();

  const last = coords[coords.length - 1];
  ctx.fillStyle = "#7C3AED";
  ctx.beginPath();
  ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
  ctx.fill();

  const labelIndexes = Array.from(
    new Set([
      0,
      Math.floor((coords.length - 1) / 2),
      coords.length - 1,
    ]),
  );
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  });

  for (const index of labelIndexes) {
    const coord = coords[index];
    ctx.fillStyle = "#6B6777";
    ctx.font = `12px ${family}`;
    ctx.fillText(
      dateFormatter.format(new Date(coord.point.timestamp)),
      coord.x - 18,
      height - 26,
    );
  }

  ctx.fillStyle = "#14121A";
  ctx.font = `bold 18px ${familyBold}`;
  ctx.fillText(formatCapCompact(last.point.value), width - 220, 38);
  ctx.fillStyle = "#6B6777";
  ctx.font = `12px ${family}`;
  ctx.fillText("Latest snapshot", width - 220, 58);

  return canvas.toBuffer("image/png");
}
