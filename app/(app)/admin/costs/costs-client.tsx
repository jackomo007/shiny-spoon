"use client";

import { useEffect, useState } from "react";

type Bucket = "day" | "week" | "month";
type SeriesRow = { key: string; chart: number; trade: number; all: number };

export default function CostsClient() {
  const [bucket, setBucket] = useState<Bucket>("day");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [total, setTotal] = useState<{ chart: number; trade: number; all: number }>({
    chart: 0,
    trade: 0,
    all: 0,
  });

  async function load() {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const url = `/api/admin/costs?since=${encodeURIComponent(since)}&bucket=${bucket}`;
      const r = await fetch(url, { cache: "no-store" });
      const js = await r.json();
      setSeries(js.series ?? []);
      setTotal(js.total ?? { chart: 0, trade: 0, all: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">OpenAI Costs</h1>
        <div className="flex items-center gap-2">
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as Bucket)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Tile label="Total" value={total.all} />
        <Tile label="Chart Analyzer" value={total.chart} />
        <Tile label="Trade Analyzer" value={total.trade} />
      </div>

      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Period</th>
              <th className="text-right p-3">Chart</th>
              <th className="text-right p-3">Trade</th>
              <th className="text-right p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : series.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  No data
                </td>
              </tr>
            ) : (
              series.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="p-3">{row.key}</td>
                  <td className="p-3 text-right">${row.chart.toFixed(4)}</td>
                  <td className="p-3 text-right">${row.trade.toFixed(4)}</td>
                  <td className="p-3 text-right font-medium">${row.all.toFixed(4)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold">${value.toFixed(4)}</div>
    </div>
  );
}
