# V2 — Materials and source inspection

**Scope:** user-visible Materials source list, upload/reindex feedback, saved generated-guide provenance, and responsive consistency. **No new learning or indexing engine.** Source APIs, Supabase ownership, RLS, revision/integrity rules, and the existing Learn player remain authoritative.

## Reconciliation and design sources

- Approved Studigo brand: `docs/DESIGN_SYSTEM.md`, `docs/brand/STUDIGO_OFFICIAL_BRAND_BOARD.png`.
- Reconciled inventory: `design/README.md` and `design/ASSET_INVENTORY.json`; current Materials CSS, `HeaderChip`, `GuidePreview`, `ModeGlyph` and companion are already shipped.
- The Phase 3 proposed `design/phase3/icons/svg` icons and `apps/web/components/phase3` source tickets were considered as reference, **not** imported. Current source buttons and download API already implement authorized original-file inspection; importing a separate icon/controller would duplicate them.

## Implemented V2 slices

| Change | Owner | UX principles |
|---|---|---|
| Source cards show **original upload**, type, filename, real processing state, file size and readable passage/coverage info in grouped order | `materials-panel.tsx`, `globals.css` | Hierarchy, Gestalt proximity/common region, Jakob's Law |
| Keep **View original** visible as primary evidence path; **Read again/Process now** only when eligible; group download/print/remove in a simple, keyboard-accessible **More** disclosure | same | Hick's Law, Fitts's Law, Occam's Razor, selective emphasis |
| Saved guide indicates actual version, cited-source count and source-inspector path; server-provided `updateAvailable` displays a clear revision warning, never an invented revision | `guide-preview.tsx` | Contrast, evidence integrity, Doherty threshold |
| Source inspection identifies the original document, provides current authorized passage and original-file link when available; unavailable passage remains unavailable with retry | `guide-preview.tsx` | Proximity, Jakob's Law, data integrity |
| Reuse existing upload/reindex operation, queue progression, error and confirmation: **no** synthetic percentage, XP, false mastery or invented processing status | `materials-panel.tsx` existing logic | Doherty threshold, trust, Tesler's Law |
| Controls maintain 44px-class targets, readable filenames and keyboard focus, responsive two-column secondary option grid on mobile | `globals.css` | Fitts's Law, scale, repetition |

## Owner visual feedback — 2026-10-17

- Removed the **fixed 138px mobile Materials heading spacer** responsible for excess white space. The existing companion collision resolver still protects the title and readable-file status and seats Studigo in the header if necessary.
- Replaced the **on-screen generated-guide word wall** with an outline: source-grounded section headings, key points as bullets, vocabulary as terms/definitions, optional examples and collapsed practice. If OCR placed a whole passage in the chapter title, it is not used as a giant heading; the original wording remains accessible through an explicit disclosure.
- Oversized individual source notes show a *verbatim excerpt* with an expandable full note, not an AI-authored summary. Existing citations, original-file links, show/hide answers and saved guide state remain unchanged.
- On iPhones the guide now follows the page's main scroll instead of creating a second 520px-tall internal scroll area.
- **UX laws:** Hick's Law and chunking (progressive disclosure), proximity/common region (key points and term groups), hierarchy/scale (short headings and readable bullets), Jakob (existing source and practice actions), Fitts (existing tap targets). No new design assets or styles were imported from `/design`; reused approved tokens.
- Only the browser presentation was changed; saved edition schema, guide generation, PDF/DOCX exports, learning logic and databases remain untouched. The owner will review the actual uploaded guide on mobile before V3.

## Intentional non-changes

- No Supabase migrations, new upload endpoint, second document processor or new citations system.
- No replacement of the accepted Learn or Explore interface, new companion, new palette or unapproved image/font.
- No extra analytics or privacy exposure; original download URLs remain server-authenticated.
- Keep the established 50 MB upload policy, MIME validation, bounded concurrency, durable processing receipts and separate private storage original untouched.

## Test/release agreement

User requested **light testing** and will supply detailed visual/user acceptance. Run baseline project validation/build and focused regression/smoke when needed; do not add a full new multi-device visual suite for V2. Explicitly distinguish Ready deployment from confirmed signed-in/source-content acceptance. If an actual regression is exposed, repair and verify it before merging.

## Owner visual acceptance (not claimed)

- [ ] Add a multi-page PDF or study guide; distinguish queued, reading, ready, partial and failed.
- [ ] At 320/390px, inspect original file, expand More, download and optionally print; check legibility and companion clearance.
- [ ] Refresh guide, verify content and citation state, and inspect a source passage at the expected original page.
- [ ] Confirm stale guide warning with a real authorized source revision.
- [ ] Confirm errors show actionable retry without stale source substitution.

V3 must wait for the owner's V2 critique.
