import React from "react";

type JournalToolbarProps = {
  activeJournalName: string;
  movedOutBanner: string | null;
  onOpenExport: () => void;
  onOpenCreate: () => void;
};

export default function JournalToolbar({
  activeJournalName,
  movedOutBanner,
  onOpenExport,
  onOpenCreate,
}: JournalToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          Active Journal:
          <span className="ml-2 inline-flex items-center rounded-full bg-white px-3 py-1 shadow-sm border text-gray-700">
            {activeJournalName || "—"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/journals"
            className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50"
            title="Manage journals"
          >
            📒 Manage Journals
          </a>
          <button
            onClick={onOpenExport}
            className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50"
          >
            📄 Export
          </button>
          <button
            onClick={onOpenCreate}
            className="h-10 w-10 rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          >
            ＋
          </button>
        </div>
      </div>

      {movedOutBanner && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {movedOutBanner}
        </div>
      )}
    </>
  );
}
