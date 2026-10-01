import assert from "node:assert/strict";
import test from "node:test";
import { backspace, composePath, deleteForward, insertText, insertUnits, type PathUnit } from "./path-editor.ts";

const numeric: PathUnit = { kind: "badge", id: "n", pattern: "[0-9]{1,20}", label: "Numérico" };

test("regex do facilitador entra inteiro e o resto vira literal", () => {
  const typed = insertText([], 0, "/V3/qbank/");
  const withBadge = insertUnits(typed.units, typed.caret, [numeric]);
  const done = insertText(withBadge.units, withBadge.caret, "/reset");
  const composed = composePath(done.units);
  assert.equal(composed.storedPath, "/v3/qbank/[0-9]{1,20}/reset$");
  assert.equal(composed.samplePath, "/v3/qbank/1/reset");
});

test("ponto digitado é escapado", () => {
  const typed = insertText([], 0, "/V1/User.Me");
  assert.equal(composePath(typed.units).storedPath, "/v1/user\\.me$");
});

test("backspace e delete apagam o badge inteiro", () => {
  const units: PathUnit[] = [
    { kind: "char", value: "/" },
    numeric,
    { kind: "char", value: "a" },
  ];
  const removed = backspace(units, 2);
  assert.deepEqual(
    removed.units.map((unit) => unit.kind),
    ["char", "char"],
  );
  assert.equal(removed.caret, 1);
  const deleted = deleteForward(units, 1);
  assert.equal(deleted.units[1]?.kind, "char");
  assert.equal(deleted.caret, 1);
});

test("regex próprio permanece como foi escrito", () => {
  const typed = insertText([], 0, "/v3/");
  const custom: PathUnit = { kind: "badge", id: "c", pattern: "[A-Z]{3}", label: "regex" };
  const withBadge = insertUnits(typed.units, typed.caret, [custom]);
  assert.equal(composePath(withBadge.units).storedPath, "/v3/[A-Z]{3}$");
  assert.equal(composePath(withBadge.units).samplePath, "/v3/x");
});

test("path vazio ou sem barra não compõe", () => {
  assert.equal(composePath([]).error, "Informe o path.");
  const typed = insertText([], 0, "v3/foo");
  assert.equal(composePath(typed.units).error, "O path precisa começar com /.");
});
