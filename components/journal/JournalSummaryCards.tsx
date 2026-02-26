import React from "react";
import Card from "@/components/ui/Card";

type JournalSummaryCardsProps = {
  totalTrades: number;
  winRate: number;
  earnings: number;
};

export default function JournalSummaryCards({
  totalTrades,
  winRate,
  earnings,
}: JournalSummaryCardsProps) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card>
        <div className="flex justify-between">
          <div className="flex flex-col">
            <div className="text-sm text-gray-600">Total Trades</div>
            <div className="mt-2 text-2xl font-semibold">{totalTrades}</div>
          </div>
          <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-yellow-400 text-white">
            👥
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between">
          <div className="flex flex-col">
            <div className="text-sm text-gray-600">Win Rate</div>
            <div className="mt-2 text-2xl font-semibold">{winRate}%</div>
          </div>
          <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-purple-500 text-white">
            👁️
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between">
          <div className="flex flex-col">
            <div className="text-sm text-gray-600">Earnings</div>
            <div className="mt-2 text-2xl font-semibold">
              {earnings ? `$${earnings.toFixed(2)}` : "$0.00"}
            </div>
          </div>
          <div className="right-6 top-6 h-10 w-10 grid place-items-center rounded-full bg-orange-500 text-white">
            $
          </div>
        </div>
      </Card>
    </div>
  );
}
