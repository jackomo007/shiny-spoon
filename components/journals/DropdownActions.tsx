import { JournalRow } from "@/app/(app)/journal/journal-client";
import { useState } from "react";

export default function DropdownActions({
  r,
  openEdit,
  askDelete,
}: {
  r: JournalRow;
  openEdit: (r: JournalRow) => void;
  askDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="px-1 py-1 rounded bg-gray-200 text-gray-800 text-xs hover:bg-gray-300"
      >
        Actions ▼
      </button>
      {open && (
        <div
          className="sticky right-0 mt-2 w-40 rounded-xl shadow-lg bg-white ring-1 ring-black/5 z-50"
          onClick={() => setOpen(false)}
        >
          <button
            onClick={() => {
              setOpen(false);
              openEdit(r);
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
          >
            Edit
          </button>

          <button
            onClick={() => {
              setOpen(false);
              askDelete(r.id);
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
