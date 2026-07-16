import React from "react";

type JournalToolbarProps = {
  activeJournalName: string;
  movedOutBanner: string | null;
  onOpenManageJournals: () => void;
  onOpenExport: () => void;
  onOpenCreate: () => void;
};

export default function JournalToolbar({
  activeJournalName,
  movedOutBanner,
  onOpenManageJournals,
  onOpenExport,
  onOpenCreate,
}: JournalToolbarProps) {
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.07em] text-[#4f46e5]">
            <span className="h-2 w-2 rounded-full bg-[#4f46e5] shadow-[0_0_0_4px_#eef2ff]" />
            Trading Journal
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#152033]">
        
          </h1>
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#e3e8f0] bg-white px-3 py-2 text-sm font-semibold text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.05)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#17b26a] shadow-[0_0_0_4px_#e8f8f0]" />
            {activeJournalName || "No active journal"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            type="button"
            onClick={onOpenManageJournals}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d4dbe6] bg-white px-3.5 py-2 text-sm font-semibold text-[#344054] shadow-sm hover:border-[#b9c3d1] hover:bg-[#f8fafc]"
            title="Manage journals"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" />
              <path d="M8 7h8M8 11h8" />
            </svg>
            Journals
          </button>
          <button
            onClick={onOpenExport}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d4dbe6] bg-white px-3.5 py-2 text-sm font-semibold text-[#344054] shadow-sm hover:border-[#b9c3d1] hover:bg-[#f8fafc]"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
            </svg>
            Export
          </button>
          <button
            onClick={onOpenCreate}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#4f46e5] bg-[#4f46e5] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(79,70,229,.18)] hover:bg-[#4338ca]"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add trade
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
