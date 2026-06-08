import React from "react";
import Card from "@/components/ui/Card";
import { Table, Th, Tr, Td } from "@/components/ui/Table";
import DropdownActions from "@/components/journals/DropdownActions";
import type { JournalRow } from "@/app/(app)/journal/journal-client";

type SortOrder = "new" | "az" | "za" | "tag_az" | "tag_za";

type TagOption = {
  id: string;
  name: string;
  color?: string;
};

type JournalTradesCardProps = {
  loading: boolean;
  error: string | null;
  rows: JournalRow[];
  showSearch: boolean;
  query: string;
  showFilter: boolean;
  showMenu: boolean;
  availableTags: TagOption[];
  selectedTagName: string;
  expandedRowId: string | null;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onQueryChange: (value: string) => void;
  onToggleFilter: () => void;
  onCloseFilter: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onSortChange: (sort: SortOrder) => void;
  onSelectedTagChange: (tagName: string) => void;
  onRefresh: () => void;
  onToggleRow: (id: string) => void;
  onOpenCloseModal: (row: JournalRow) => void;
  onOpenEdit: (row: JournalRow) => void;
  onAskDelete: (id: string) => void;
  renderStatusButton: (row: JournalRow) => React.ReactNode;
  fmt4: (n: number | null | undefined) => string;
  money2: (n: number) => string;
};

export default function JournalTradesCard({
  loading,
  error,
  rows,
  showSearch,
  query,
  showFilter,
  showMenu,
  availableTags,
  selectedTagName,
  expandedRowId,
  onToggleSearch,
  onCloseSearch,
  onQueryChange,
  onToggleFilter,
  onCloseFilter,
  onToggleMenu,
  onCloseMenu,
  onSortChange,
  onSelectedTagChange,
  onRefresh,
  onToggleRow,
  onOpenCloseModal,
  onOpenEdit,
  onAskDelete,
  renderStatusButton,
  fmt4,
  money2,
}: JournalTradesCardProps) {
  function tagColor(name: string) {
    return availableTags.find((tag) => tag.name === name)?.color ?? "#9CA3AF";
  }

  function renderTags(tags?: string[]) {
    const clean = (tags ?? []).filter(Boolean);
    if (!clean.length) return <span className="text-gray-400">-</span>;

    return (
      <div className="flex flex-wrap gap-1.5">
        {clean.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: tagColor(tag) }}
            />
            {tag}
          </span>
        ))}
      </div>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      {showSearch && (
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-gray-400">🔍</span>
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Type and hit enter ..."
              className="flex-1 outline-none bg-transparent text-gray-700 placeholder:text-gray-400"
            />
            <button
              onClick={onCloseSearch}
              className="text-gray-400 hover:text-gray-600"
            >
              ✖
            </button>
          </div>
        </div>
      )}

      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Trades</h3>
        <div className="flex items-center gap-3 relative">
          <button
            onClick={onToggleSearch}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            🔍
          </button>

          <div className="relative">
            <button
              onClick={onToggleFilter}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              🧰
            </button>
            {showFilter && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                onMouseLeave={onCloseFilter}
              >
                <MenuItem
                  label="Newest"
                  onClick={() => {
                    onSortChange("new");
                    onCloseFilter();
                  }}
                  icon="🧾"
                />
                <MenuItem
                  label="From A-Z"
                  onClick={() => {
                    onSortChange("az");
                    onCloseFilter();
                  }}
                  icon="🔤"
                />
                <MenuItem
                  label="From Z-A"
                  onClick={() => {
                    onSortChange("za");
                    onCloseFilter();
                  }}
                  icon="🔠"
                />
                <MenuItem
                  label="Tag A-Z"
                  onClick={() => {
                    onSortChange("tag_az");
                    onCloseFilter();
                  }}
                />
                <MenuItem
                  label="Tag Z-A"
                  onClick={() => {
                    onSortChange("tag_za");
                    onCloseFilter();
                  }}
                />
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => onSelectedTagChange("")}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                    selectedTagName
                      ? "text-gray-600"
                      : "font-semibold text-gray-900"
                  }`}
                >
                  All tags
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => onSelectedTagChange(tag.name)}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      selectedTagName === tag.name
                        ? "font-semibold text-gray-900"
                        : "text-gray-700"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color ?? "#9CA3AF" }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={onToggleMenu}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              ⋯
            </button>
            {showMenu && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                onMouseLeave={onCloseMenu}
              >
                <MenuItem
                  label="Refresh"
                  onClick={() => {
                    onRefresh();
                    onCloseMenu();
                  }}
                />
                <MenuItem label="Manage Widgets" onClick={onCloseMenu} />
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedTagName && (
        <div className="px-6 pb-3">
          <button
            type="button"
            onClick={() => onSelectedTagChange("")}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: tagColor(selectedTagName) }}
            />
            {selectedTagName}
            <span className="text-gray-500">x</span>
          </button>
        </div>
      )}

      <div className="px-6 pb-2 overflow-x-auto hidden md:block">
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Loading…
          </div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-red-600">{error}</div>
        ) : (
          <Table className="min-w-[800px] md:min-w-full text-xs [&_td]:py-1 [&_th]:py-1">
            <thead>
              <tr>
                <Th className="w-6"></Th>
                <Th className="whitespace-nowrap w-28 md:w-36">Asset</Th>
                <Th className="whitespace-nowrap w-20 md:w-24">Type</Th>
                <Th className="whitespace-nowrap w-28">Entry</Th>
                <Th className="whitespace-nowrap w-28">Exit</Th>
                <Th className="whitespace-nowrap w-36">
                  Amount
                  <br />
                  Spent
                </Th>
                <Th className="whitespace-nowrap w-28">PnL</Th>
                <Th className="whitespace-nowrap hidden md:table-cell w-56">
                  Date
                </Th>
                <Th className="whitespace-nowrap w-40">Tags</Th>
                <Th className="whitespace-nowrap w-40">Status / Action</Th>
                <Th className="w-40"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <Tr
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => onToggleRow(r.id)}
                  >
                    <Td className="w-6">
                      <span>{expandedRowId === r.id ? "▾" : "▸"}</span>
                    </Td>

                    <Td className="whitespace-nowrap w-28 md:w-36">
                      {r.asset_name}
                    </Td>

                    <Td className="whitespace-nowrap w-20 md:w-24">
                      {r.trade_type === 2 ? "Futures" : "Spot"} ({r.side})
                    </Td>

                    <Td className="font-mono w-28">${fmt4(r.entry_price)}</Td>

                    <Td className="font-mono w-28">
                      {r.exit_price != null ? `$${fmt4(r.exit_price)}` : "—"}
                    </Td>

                    <Td className="font-mono w-36">{money2(r.amount_spent)}</Td>

                    <Td className="font-mono w-28">
                      {r.pnl != null ? money2(r.pnl) : "—"}
                    </Td>

                    <Td className="hidden md:table-cell leading-tight">
                      {new Date(r.date).toLocaleDateString()},
                      <br />
                      {new Date(r.date).toLocaleTimeString()}
                    </Td>

                    <Td className="w-40">{renderTags(r.tags)}</Td>

                    <Td className="w-32 relative">{renderStatusButton(r)}</Td>

                    <Td className="w-32 relative">
                      <DropdownActions
                        r={r}
                        openEdit={onOpenEdit}
                        askDelete={onAskDelete}
                      />
                    </Td>
                  </Tr>

                  {expandedRowId === r.id && (
                    <Tr className="bg-gray-50">
                      <Td
                        colSpan={11}
                        className="px-6 py-2 text-xs text-gray-700"
                      >
                        <div className="flex flex-wrap gap-6">
                          <div>
                            <span className="font-semibold mr-1">
                              Quantity:
                            </span>
                            <span className="font-mono">
                              {r.entry_price > 0
                                ? fmt4(r.amount_spent / r.entry_price)
                                : "—"}
                            </span>
                          </div>

                          <div>
                            <span className="font-semibold mr-1">
                              Stop Loss:
                            </span>
                            <span className="font-mono">
                              {r.stop_loss_price != null
                                ? fmt4(r.stop_loss_price)
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </Td>
                    </Tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <div className="px-6 pb-4 md:hidden">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-600">{error}</div>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {r.asset_name}{" "}
                    <span className="text-xs text-gray-500">
                      ({r.trade_type === 2 ? "Futures" : "Spot"})
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Side</div>
                    <div className="font-mono">{r.side}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 text-xs">Date</div>
                    <div>{new Date(r.date).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Entry</div>
                    <div className="font-mono">{fmt4(r.entry_price)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 text-xs">Exit</div>
                    <div className="font-mono">
                      {r.exit_price != null ? fmt4(r.exit_price) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Amount Spent</div>
                    <div className="font-mono">{money2(r.amount_spent)}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-gray-500 text-xs">Tags</div>
                    <div className="mt-1">{renderTags(r.tags)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500 text-xs">Quantity</div>
                    <div className="font-mono">
                      {r.entry_price > 0
                        ? fmt4(r.amount_spent / r.entry_price)
                        : "—"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-gray-500 text-xs">PnL</div>
                    <div className="font-mono">
                      {r.pnl != null ? money2(r.pnl) : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  {r.status === "in_progress" ? (
                    <button
                      title="Close Trade"
                      onClick={() => onOpenCloseModal(r)}
                      className="px-3 py-2 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                    >
                      Close Trade
                    </button>
                  ) : (
                    <span className="text-xs text-gray-600">
                      {r.status.replace("_", " ")}
                    </span>
                  )}
                  <div className="flex gap-3">
                    <button
                      title="Edit"
                      onClick={() => onOpenEdit(r)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      ✏️
                    </button>
                    <button
                      title="Delete"
                      onClick={() => onAskDelete(r.id)}
                      className="text-orange-600 hover:text-orange-700"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function MenuItem({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-xl flex items-center gap-3"
    >
      {icon && <span>{icon}</span>}
      <span className="text-sm">{label}</span>
    </button>
  );
}
