import { JournalRow } from "@/app/(app)/journal/journal-client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
        className="px-2 py-1 rounded bg-gray-200 text-gray-800 text-xs hover:bg-gray-300 cursor-pointer"
      >
        Actions ▼
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed rounded-xl shadow-lg bg-white ring-1 ring-black/5 z-[9999]"
            onClick={(e) => e.stopPropagation()} // não colapsar a linha ao clicar no menu
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openEdit(r);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                askDelete(r.id);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 cursor-pointer"
            >
              Delete
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
