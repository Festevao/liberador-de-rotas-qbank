import assert from "node:assert/strict";
import test from "node:test";
import { parseMysqlUrl } from "./mysql-url.ts";

test("lê usuário, senha, host, porta e database", () => {
  const parsed = parseMysqlUrl(
    "mysql://felipi.trindade:p%40ss@127.0.0.1:26524/medcof?sslmode=require",
  );
  assert.equal(parsed?.user, "felipi.trindade");
  assert.equal(parsed?.password, "p@ss");
  assert.equal(parsed?.host, "127.0.0.1");
  assert.equal(parsed?.port, 26524);
  assert.equal(parsed?.database, "medcof");
  assert.equal(parsed?.ssl, true);
  assert.equal(parsed?.iamCleartext, false);
});

test("decodifica o token IAM uma vez a mais e liga o cleartext", () => {
  const parsed = parseMysqlUrl(
    "mysql://user:host%3A3306%2F%3FAction%3Dconnect%26X-Amz-Credential%3DABC%252F2026@127.0.0.1:26524/medcof?sslmode=require",
  );
  assert.equal(parsed?.password, "host:3306/?Action=connect&X-Amz-Credential=ABC%2F2026");
  assert.equal(parsed?.iamCleartext, true);
});

test("desliga ssl quando sslmode=disable", () => {
  const parsed = parseMysqlUrl("mysql://user:secret@localhost:3306/app?sslmode=disable");
  assert.equal(parsed?.ssl, false);
  assert.equal(parsed?.iamCleartext, false);
});

test("rejeita string que não é mysql", () => {
  assert.equal(parseMysqlUrl("postgres://user:secret@localhost/app"), null);
  assert.equal(parseMysqlUrl("não é url"), null);
});
