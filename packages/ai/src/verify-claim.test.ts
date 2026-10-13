import assert from "node:assert/strict";
import test from "node:test";
import { claimSupportedByChunk, groundingStatus, splitClaims, verifyClaims } from "./verify-claim";

test("verifyClaims: a valid [1] on an unsupported sentence is citation_present; a supported one is verified", () => {
  const chunks = ["Tornadoes form from rotating supercells.", "Deserts receive little rainfall."];
  const result = verifyClaims({
    text: "Tornadoes form in deserts [2]. Tornadoes form from rotating supercells [1]. Hail is ice.",
    chunkTexts: chunks
  });
  assert.deepEqual(result.claims.map((c) => c.status), ["citation_present", "verified", "no_evidence"]);
  assert.deepEqual([result.verified, result.citationPresent, result.noEvidence], [1, 1, 1]);
  const wrong = verifyClaims({ text: "Tornadoes form in deserts [1].", chunkTexts: chunks });
  assert.equal(wrong.claims[0]!.status, "citation_present");
});

test("splitClaims parses [n, m] markers and keeps a trailing marker with its sentence", () => {
  const claims = splitClaims("Alpha beta gamma [1, 2]. [3]\n- Delta epsilon zeta [2]");
  assert.deepEqual(claims.map((c) => c.citations), [[1, 2, 3], [2]]);
});

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
