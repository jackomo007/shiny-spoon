import React from "react";
import Modal from "@/components/ui/Modal";

type DeleteEntryModalProps = {
  open: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteEntryModal({
  open,
  deleting,
  onClose,
  onConfirm,
}: DeleteEntryModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete entry?"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      }
    >
      <div className="text-sm text-gray-600">This action cannot be undone.</div>
    </Modal>
  );
}
