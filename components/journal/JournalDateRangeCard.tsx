import React from "react";
import Card from "@/components/ui/Card";

type JournalDateRangeCardProps = {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export default function JournalDateRangeCard({
  start,
  end,
  onStartChange,
  onEndChange,
  onApply,
  onReset,
}: JournalDateRangeCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-gray-600">Date range:</div>

        <input
          type="date"
          value={start}
          onChange={(e) => onStartChange(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2"
        />
        <span className="text-gray-400">—</span>
        <input
          type="date"
          value={end}
          onChange={(e) => onEndChange(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2"
        />

        <button className="rounded-xl bg-white px-3 py-2 text-sm border" onClick={onApply}>
          Apply
        </button>
        <button className="rounded-xl bg-gray-100 px-3 py-2 text-sm" onClick={onReset}>
          Reset
        </button>
      </div>
    </Card>
  );
}
