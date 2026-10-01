"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { fieldClass } from "@/components/field";
import {
  insertText,
  insertUnits,
  isValidCustomPattern,
  backspace,
  deleteForward,
  type PathUnit,
} from "@/lib/path-editor";
import { PRESETS, PRESET_IDS } from "@/lib/regex";

interface Props {
  units: PathUnit[];
  caret: number;
  active: boolean;
  error?: string;
  storedPath?: string;
  onChange: (units: PathUnit[], caret: number) => void;
  onFocus: () => void;
}

export function PathField({ units, caret, active, error, storedPath, onChange, onFocus }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  function focusBox() {
    onFocus();
    boxRef.current?.focus();
  }

  function placeCaret(index: number) {
    onChange(units, index);
    focusBox();
  }

  function insertBadge(pattern: string, label: string) {
    const next = insertUnits(units, caret, [
      { kind: "badge", id: crypto.randomUUID(), pattern, label },
    ]);
    onChange(next.units, next.caret);
    focusBox();
  }

  function insertCustom() {
    const pattern = custom.trim();
    if (!isValidCustomPattern(pattern)) {
      setCustomError("Esse regex não fecha.");
      return;
    }
    const preset = PRESET_IDS.find((id) => PRESETS[id].pattern === pattern);
    insertBadge(pattern, preset ? PRESETS[preset].label : "regex");
    setCustom("");
    setCustomError(null);
  }

  function onBoxMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    placeCaret(units.length);
  }

  return (
    <div>
      <div
        ref={boxRef}
        role="textbox"
        tabIndex={0}
        aria-label="Path da rota"
        className={`${fieldClass} flex h-auto min-h-10 cursor-text flex-wrap items-center gap-x-0.5 py-1 font-mono text-xs`}
        onFocus={onFocus}
        onMouseDown={onBoxMouseDown}
        onPaste={(event) => {
          event.preventDefault();
          const next = insertText(units, caret, event.clipboardData.getData("text"));
          onChange(next.units, next.caret);
        }}
        onKeyDown={(event) => {
          if (event.key === "Backspace") {
            event.preventDefault();
            const next = backspace(units, caret);
            onChange(next.units, next.caret);
            return;
          }
          if (event.key === "Delete") {
            event.preventDefault();
            const next = deleteForward(units, caret);
            onChange(next.units, next.caret);
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onChange(units, Math.max(0, caret - 1));
            return;
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onChange(units, Math.min(units.length, caret + 1));
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            onChange(units, 0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            onChange(units, units.length);
            return;
          }
          if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
          event.preventDefault();
          const next = insertText(units, caret, event.key);
          onChange(next.units, next.caret);
        }}
      >
        {units.length === 0 ? (
          <span className="pointer-events-none text-[var(--muted)]">/v3/qbank/…</span>
        ) : null}
        <PathUnits
          units={units}
          caret={caret}
          active={active}
          onCaret={placeCaret}
        />
        <span className="min-w-2 flex-1 self-stretch" onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          placeCaret(units.length);
        }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            title={PRESETS[id].pattern}
            className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 font-mono text-[0.65rem] text-[var(--foreground)]"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertBadge(PRESETS[id].pattern, PRESETS[id].label)}
          >
            {PRESETS[id].label}
          </button>
        ))}
        <input
          className="h-7 w-36 rounded-md border border-[var(--line)] bg-white px-2 font-mono text-[0.65rem]"
          value={custom}
          placeholder="seu regex"
          spellCheck={false}
          aria-label="Regex próprio"
          onChange={(event) => {
            setCustom(event.target.value);
            setCustomError(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            insertCustom();
          }}
        />
        <button
          type="button"
          className="h-7 rounded-md border border-[var(--line)] bg-white px-2 text-xs"
          onClick={insertCustom}
        >
          Inserir
        </button>
      </div>
      {customError ? <p className="mt-1 text-xs text-[var(--danger)]">{customError}</p> : null}
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
      {storedPath ? (
        <p className="mt-1 font-mono text-[0.65rem] break-all text-[var(--accent)]">{storedPath}</p>
      ) : null}
    </div>
  );
}

function PathUnits({
  units,
  caret,
  active,
  onCaret,
}: {
  units: PathUnit[];
  caret: number;
  active: boolean;
  onCaret: (index: number) => void;
}) {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let bufferStart = 0;

  function flush() {
    if (!buffer) return;
    const start = bufferStart;
    const text = buffer;
    nodes.push(
      <span
        key={`t-${start}`}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const offset = offsetInSpan(event.currentTarget, event.clientX);
          onCaret(start + offset);
        }}
      >
        {text}
      </span>,
    );
    buffer = "";
  }

  function caretMark(key: string) {
    if (!active) return;
    nodes.push(
      <span key={key} aria-hidden className="inline-block h-4 w-px self-center bg-[var(--foreground)]" />,
    );
  }

  units.forEach((unit, index) => {
    if (index === caret) {
      flush();
      caretMark(`c-${index}`);
    }
    if (unit.kind === "char") {
      if (!buffer) bufferStart = index;
      buffer += unit.value;
      return;
    }
    flush();
    nodes.push(
      <span
        key={unit.id}
        title={unit.label}
        className="mx-px inline-flex select-none items-center rounded bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--accent-ink)]"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          const after = event.clientX > rect.left + rect.width / 2;
          onCaret(after ? index + 1 : index);
        }}
      >
        {unit.pattern}
      </span>,
    );
  });
  flush();
  if (caret === units.length) caretMark("c-end");
  return nodes;
}

function offsetInSpan(span: HTMLElement, clientX: number): number {
  const text = span.textContent ?? "";
  const node = span.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return text.length;
  const range = document.createRange();
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= text.length; index += 1) {
    range.setStart(node, index);
    range.setEnd(node, index);
    const distance = Math.abs(range.getBoundingClientRect().left - clientX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}
