"use client";

import { useMemo, useState } from "react";
import { fieldClass, labelClass } from "@/components/field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface Option {
  value: string;
  label: string;
}

interface SearchSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Buscar",
  allowEmpty = true,
  emptyLabel = "Todos",
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) || option.value.includes(term),
    );
  }, [debouncedSearch, options]);

  return (
    <div className="relative">
      <span className={labelClass}>{label}</span>
      <button
        type="button"
        className={`${fieldClass} text-left`}
        onClick={() => setOpen((current) => !current)}
      >
        {selected?.label ?? (allowEmpty ? emptyLabel : placeholder)}
      </button>
      {open ? (
        <>
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          aria-label="Fechar lista"
          onClick={() => setOpen(false)}
        />
        <div className="absolute z-20 mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] p-2 shadow-lg">
          <input
            className={fieldClass}
            value={search}
            placeholder={placeholder}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          <ul className="mt-2 max-h-56 overflow-auto">
            {allowEmpty ? (
              <li>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#efe8da]"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#efe8da]"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="mr-2 font-mono text-xs text-[var(--muted)]">{option.value}</span>
                  {option.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-[var(--muted)]">Nada encontrado.</li>
            ) : null}
          </ul>
        </div>
        </>
      ) : null}
    </div>
  );
}
