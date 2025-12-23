"use client";

import { useState } from "react";

export default function RefreshSrButton({
  trackerId,
  onRefreshed,
}: {
  trackerId: string;
  onRefreshed?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/chart-trackers/${trackerId}/refresh-sr`, {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      onRefreshed?.();
    } catch (e) {
      // optional
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={loading}
      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      title="Refetch the next 3 supports and resistances"
    >
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  );
}
