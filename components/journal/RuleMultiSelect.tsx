"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RuleOption = {
  id: string;
  title: string;
};

type RuleMultiSelectProps = {
  options: RuleOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export default function RuleMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select confluences",
}: RuleMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedRules = useMemo(
    () => options.filter((rule) => value.includes(rule.id)),
    [options, value],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleRule(ruleId: string) {
    if (value.includes(ruleId)) {
      onChange(value.filter((id) => id !== ruleId));
      return;
    }

    onChange([...value, ruleId]);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setOpen((current) => !current);
        }}
        className="flex min-h-[46px] w-full flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition focus:border-[#0B6B43] focus:outline-none focus:ring-2 focus:ring-[#0B6B43]/20"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedRules.length ? (
          selectedRules.map((rule) => (
            <span
              key={rule.id}
              className="inline-flex items-center gap-1 rounded-lg bg-[#E8F6EE] px-2 py-1 text-sm font-medium text-[#0B6B43]"
            >
              <span>{rule.title}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((id) => id !== rule.id));
                }}
                aria-label={`Remove ${rule.title}`}
                className="leading-none text-[#0B6B43]/70 transition hover:text-[#0B6B43]"
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}

        <svg
          className={`ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-20 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
          role="listbox"
          aria-multiselectable="true"
        >
          {options.map((rule) => {
            const selected = value.includes(rule.id);

            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => toggleRule(rule.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                  selected
                    ? "bg-[#E8F6EE] text-[#0B6B43]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                role="option"
                aria-selected={selected}
              >
                <span>{rule.title}</span>
                <span
                  className={`text-xs font-semibold ${selected ? "opacity-100" : "opacity-0"}`}
                >
                  Selected
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
