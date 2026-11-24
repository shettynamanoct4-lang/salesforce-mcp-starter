import { test } from "node:test";
import assert from "node:assert/strict";
import { assertReadOnlySoql, MAX_ROWS } from "./guards.js";

test("adds a LIMIT when missing", () => {
  assert.equal(assertReadOnlySoql("SELECT Id FROM Account"), `SELECT Id FROM Account LIMIT ${MAX_ROWS}`);
});

test("caps an oversized LIMIT", () => {
  assert.equal(assertReadOnlySoql("SELECT Id FROM Account LIMIT 50000"), `SELECT Id FROM Account LIMIT ${MAX_ROWS}`);
});

test("rejects non-SELECT statements", () => {
  assert.throws(() => assertReadOnlySoql("DELETE FROM Account"));
});

test("rejects DML keywords hidden in a query", () => {
  assert.throws(() => assertReadOnlySoql("SELECT Id FROM Account WHERE Name = 'x'; delete x"));
});
