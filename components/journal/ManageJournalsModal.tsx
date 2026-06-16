"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

export type ManageJournalItem = {
  id: string;
  name: string;
  created_at?: string;
};

type ManageJournalsModalProps = {
  open: boolean;
  journals: ManageJournalItem[];
  activeJournalId: string | null;
  pendingAction: string | null;
  error: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

export default function ManageJournalsModal({
  open,
  journals,
  activeJournalId,
  pendingAction,
  error,
  onClose,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ManageJournalsModalProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ManageJournalItem | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setDeleteTarget(null);
      setEditingId(null);
      setEditingName("");
    }
  }, [open]);

  function submitCreate() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
  }

  function startRename(journal: ManageJournalItem) {
    setEditingId(journal.id);
    setEditingName(journal.name);
  }

  function submitRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    onRename(id, name);
    setEditingId(null);
    setEditingName("");
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Journals" widthClass="max-w-lg">
      <div className="grid gap-4">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCreate();
              }
            }}
            placeholder="New journal name"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!newName.trim() || pendingAction === "create"}
            onClick={submitCreate}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          >
            {pendingAction === "create" ? "Creating..." : "Create"}
          </button>
        </div>

        {journals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            No journals found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {journals.map((journal) => {
              const isActive = journal.id === activeJournalId;
              const isSwitching = pendingAction === `select:${journal.id}`;
              const isRenaming = pendingAction === `rename:${journal.id}`;
              const isDeleting = pendingAction === `delete:${journal.id}`;
              const isEditing = editingId === journal.id;

              return (
                <div
                  key={journal.id}
                  className="grid gap-3 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitRename(journal.id);
                            }
                          }}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        />
                      ) : (
                        <div className="truncate text-sm font-semibold text-gray-800">
                          {journal.name || "Untitled"}
                        </div>
                      )}
                      {isActive && (
                        <div className="mt-1 text-xs font-medium text-green-600">
                          Active journal
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={!editingName.trim() || isRenaming}
                            onClick={() => submitRename(journal.id)}
                            className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                          >
                            {isRenaming ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditingName("");
                            }}
                            className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isActive || isSwitching}
                            onClick={() => onSelect(journal.id)}
                            className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                          >
                            {isActive
                              ? "Active"
                              : isSwitching
                                ? "Switching..."
                                : "Set Active"}
                          </button>
                          <button
                            type="button"
                            onClick={() => startRename(journal)}
                            className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setDeleteTarget(journal)}
                            className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {deleteTarget && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-700">
              Delete {deleteTarget.name || "Untitled"}?
            </div>
            <div className="mt-1 text-sm text-red-600">
              This will permanently delete this journal and all of its trades.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pendingAction === `delete:${deleteTarget.id}`}
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === `delete:${deleteTarget.id}`
                  ? "Deleting..."
                  : "Delete Journal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
