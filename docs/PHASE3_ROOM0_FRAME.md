# Phase 3 · Room 0 shared frame

This slice starts from `main` at `89e1e94`. It changes the shared Study Room frame only. Coach/Learn, Materials, grading, persistence, mode routing, and the five section names retain their existing owners and behavior. PR #149 is a design reference; this slice does not depend on its proposed imagery, icons, or preview components.

## Switch and rollback

`PHASE3_ROOM0_ROOM_IDS` is a server-only, comma-separated list of room IDs. An empty value leaves every room on the old frame. Listing one ID enables the treatment only for that room; remove it and redeploy to return to the old markup and styling. `/dev/study?frame=phase3` previews the on state locally, and `/dev/study` previews the off state with the same synthetic fixture. The production flag is resolved after the signed-in room is loaded; it is not controlled by a browser query string.

## Visible change

- The header names the current section above the room title and refines the existing room-color frame.
- The five section controls use a quieter well and a more legible selected state. They keep their existing labels, glyphs, actions, and order.
- On wide screens the existing ready-source count becomes a button to Materials. It uses the real authorized document list passed to the room; it does not claim a verified passage or invent a new source endpoint. The current mobile layout hides that count in both states and retains the Materials tab.

## Review gate

Verify the same room at compact phone, large phone, tablet, and desktop widths with flag off/on; switch through all five sections, follow an existing deep link, use the Coach/Learn switch, and inspect keyboard focus, zoom and reduced motion. Confirm the source shortcut enters Materials and the off state has the original static count. Check a room absent from the ID list. Do not enable production rooms until these captures and interactions are reviewed. Room 1 will handle original-file, guide, verified passage, partial OCR and stale-source states.

Local checks on this change: typecheck, production build, and 423 web tests pass. Rendered width and assistive-technology review are still open in this runner because it has no browser executable.
