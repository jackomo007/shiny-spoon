import React from "react";
import Modal from "@/components/ui/Modal";

type ExportModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ExportModal({ open, onClose }: ExportModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export"
      footer={
        <div className="flex justify-end">
          <button
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      }
    >
      <div className="text-sm text-gray-700">This feature is coming soon.</div>
    </Modal>
  );
}
