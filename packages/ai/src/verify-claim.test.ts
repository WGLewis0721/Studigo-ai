import assert from "node:assert/strict";
import test from "node:test";
import { claimSupportedByChunk, groundingStatus } from "./verify-claim";

test("a valid citation marker is not verified when the chunk does not support the claim", () => {
  const claim = "Tornadoes form in deserts";
  const chunk = "Tornadoes form from rotating supercells.";
  assert.equal(claimSupportedByChunk(claim, chunk), false);
  assert.equal(
    groundingStatus({ citationCount: 1, claim, chunkTexts: [chunk] }),
    "citation_present"
  );
});

test("a claim is verified only when the cited chunk contains its content words", () => {
  const claim = "Tornadoes form from rotating supercells";
  const chunk = "Tornadoes form from rotating supercells.";
  assert.equal(
    groundingStatus({ citationCount: 1, claim, chunkTexts: [chunk] }),
    "verified"
  );
});

test("no citation is no_evidence even if some chunk matches", () => {
  assert.equal(
    groundingStatus({
      citationCount: 0,
      claim: "Tornadoes form from rotating supercells",
      chunkTexts: ["Tornadoes form from rotating supercells."]
    }),
    "no_evidence"
  );
});
