import "dotenv/config";
import { findDueTrackers, runAnalysisForTracker } from "@/services/tracker.service";

const LOOP_EVERY_MS = 60_000;

async function tick() {
  try {
    const due = await findDueTrackers();
    if (!due.length) {
      console.log("[local-cron] nothing due");
      return;
    }
    console.log(`[local-cron] due=${due.length} -> running...`);
    for (const t of due) {
      try {
        await runAnalysisForTracker(t.id);
        console.log(`[local-cron] ok -> ${t.tv_symbol} ${t.tf}`);
      } catch (e) {
        console.error(`[local-cron] fail -> ${t.tv_symbol} ${t.tf}`, e);
      }
    }
  } catch (e) {
    console.error("[local-cron] tick error", e);
  }
}

async function main() {
  console.log("[local-cron] started");
  await tick();
  setInterval(tick, LOOP_EVERY_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
