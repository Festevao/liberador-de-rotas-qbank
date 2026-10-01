import { escapeStatic, normalizeRequestPath, sampleForPattern } from "./regex.ts";

export interface PathChar {
  kind: "char";
  value: string;
}

export interface PathBadge {
  kind: "badge";
  id: string;
  pattern: string;
  label: string;
}

export type PathUnit = PathChar | PathBadge;

export interface PathEdit {
  units: PathUnit[];
  caret: number;
}

export interface ComposedPath {
  storedPath: string;
  samplePath: string;
  visible: string;
  error?: string;
}

export function insertUnits(units: PathUnit[], caret: number, incoming: PathUnit[]): PathEdit {
  const index = clamp(caret, 0, units.length);
  return {
    units: [...units.slice(0, index), ...incoming, ...units.slice(index)],
    caret: index + incoming.length,
  };
}

export function insertText(units: PathUnit[], caret: number, text: string): PathEdit {
  const chars: PathChar[] = [...text]
    .filter((value) => value !== "\n" && value !== "\r")
    .map((value) => ({ kind: "char", value }));
  return insertUnits(units, caret, chars);
}

export function backspace(units: PathUnit[], caret: number): PathEdit {
  if (caret <= 0) return { units, caret: 0 };
  const index = Math.min(caret, units.length);
  return {
    units: [...units.slice(0, index - 1), ...units.slice(index)],
    caret: index - 1,
  };
}

export function deleteForward(units: PathUnit[], caret: number): PathEdit {
  if (caret >= units.length) return { units, caret: units.length };
  const index = Math.max(0, caret);
  return {
    units: [...units.slice(0, index), ...units.slice(index + 1)],
    caret: index,
  };
}

export function composePath(units: PathUnit[]): ComposedPath {
  const visible = units.map((unit) => (unit.kind === "char" ? unit.value : unit.pattern)).join("");
  if (units.length === 0) {
    return { storedPath: "", samplePath: "", visible, error: "Informe o path." };
  }

  let stored = "";
  let sample = "";
  for (const unit of units) {
    if (unit.kind === "char") {
      stored += escapeStatic(unit.value);
      sample += unit.value.toLowerCase();
      continue;
    }
    stored += unit.pattern;
    sample += sampleForPattern(unit.pattern);
  }

  if (stored.startsWith("^")) {
    return {
      storedPath: "",
      samplePath: "",
      visible,
      error: "Não comece com ^ — o middleware adiciona isso.",
    };
  }
  if (!stored.startsWith("/")) {
    return { storedPath: "", samplePath: "", visible, error: "O path precisa começar com /." };
  }
  if (!endsWithAnchor(stored)) stored += "$";
  if (stored.length > 255) {
    return { storedPath: "", samplePath: "", visible, error: "Path maior que 255 caracteres." };
  }
  return {
    storedPath: stored,
    samplePath: normalizeRequestPath(sample),
    visible,
  };
}

export function isValidCustomPattern(pattern: string): boolean {
  if (!pattern.trim() || pattern.includes("\n") || pattern.includes("\r")) return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function endsWithAnchor(pattern: string): boolean {
  return /(?<!\\)\$$/.test(pattern);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
