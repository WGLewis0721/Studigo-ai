import { test } from "node:test";
import assert from "node:assert/strict";
import { isSignedInAccount } from "./account-kind";

test("anonymous Supabase sessions are not signed-in accounts", () => {
  assert.equal(isSignedInAccount(null), false);
  assert.equal(isSignedInAccount(undefined), false);
  assert.equal(isSignedInAccount({ is_anonymous: true }), false);
  assert.equal(isSignedInAccount({ is_anonymous: false }), true);
  assert.equal(isSignedInAccount({}), true);
});
