import assert from "node:assert/strict";
import test from "node:test";
import { buildStoredPath, normalizeRequestPath, parseBulk } from "./regex.ts";
import { likeContains } from "./sql.ts";

test("monta regex com $ e sem ^", () => {
  const stored = buildStoredPath("/v3/qbank/:qbankId/reset", ["numeric"]);
  assert.equal(stored, "/v3/qbank/[0-9]{1,20}/reset$");
  assert.equal(stored.startsWith("^"), false);
});

test("escapa ponto e baixa o path estático", () => {
  const stored = buildStoredPath("/V1/User.Me", []);
  assert.equal(stored, "/v1/user\\.me$");
});

test("object id é o preset padrão", () => {
  const stored = buildStoredPath("/articles/:id", ["objectId"]);
  assert.equal(stored, "/articles/[a-fA-F0-9]{24}$");
});

test("interpreta várias linhas e ignora comentário", () => {
  const parsed = parseBulk(
    "# comentario\nGET /v3/foo/:id | busca foo\n\nPOST /v3/foo",
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.method, "GET");
  assert.equal(parsed[0]?.observacao, "busca foo");
  assert.deepEqual(parsed[0]?.params, [{ name: "id" }]);
  assert.equal(parsed[1]?.expressPath, "/v3/foo");
});

test("normaliza path como o middleware", () => {
  assert.equal(
    normalizeRequestPath("/V3/Qbank/1/Reset/?page=1"),
    "/v3/qbank/1/reset",
  );
});

test("escapa curingas do LIKE", () => {
  assert.equal(likeContains("100%_a"), "%100\\%\\_a%");
});
