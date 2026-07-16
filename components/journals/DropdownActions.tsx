import { JournalRow } from "@/app/(app)/journal/journal-client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function DropdownActions({
  r,
  openEdit,
  askDelete,
  onQuickClose,
}: {
  r: JournalRow;
  openEdit: (r: JournalRow) => void;
  askDelete: (id: string) => void;
  onQuickClose?: (r: JournalRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 160,
  });

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const el = btnRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const menuWidth = 180;

      // alinha o menu à direita do botão
      const left = Math.max(8, rect.right - menuWidth);
      const top = rect.bottom + 8;

      setPos({ top, left, width: menuWidth });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // impede trigger do toggleRow no <Tr>
          setOpen((v) => !v);
        }}
        className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-[#e3e8f0] bg-white text-[#667085] hover:border-[#d4dbe6] hover:bg-[#f8fafc]"
        aria-label="Open trade actions"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed rounded-xl border border-[#e3e8f0] bg-white p-1.5 shadow-[0_12px_28px_rgba(16,24,40,.14)] z-[9999]"
            onClick={(e) => e.stopPropagation()} // não colapsar a linha ao clicar no menu
          >
            {r.status === "in_progress" && onQuickClose && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onQuickClose(r);
                }}
                className="mb-1 flex min-h-9 w-full items-center gap-2 rounded-lg border-b border-[#f3d9de] px-2.5 text-left text-xs font-semibold text-[#d83a52] hover:bg-[#fff0f2]"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                  <path d="M9 12h6" />
                </svg>
                Quick Close
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openEdit(r);
              }}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold text-[#344054] hover:bg-[#f8fafc]"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
              </svg>
              Edit Trade
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                askDelete(r.id);
              }}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold text-[#d83a52] hover:bg-[#fff0f2]"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="m19 6-1 14H6L5 6" />
                <path d="M10 11v5M14 11v5" />
              </svg>
              Delete
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
