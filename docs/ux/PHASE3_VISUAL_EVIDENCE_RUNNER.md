# Phase 3 visual evidence runner

`scripts/phase3-visual-qa.mjs` and `.github/workflows/phase3-visual-evidence.yml` capture the **same-commit** synthetic Study Room in the legacy and Phase 3 shells. The synthetic fixture is available only to a development server or flagged Vercel preview, never as a public production route.

The workflow captures Coach, Materials, Quiz, Mastery and Plan at 320px phone, 390px phone, 820px tablet and 1440px desktop: 40 named images plus a machine-readable `report.json`. It verifies that each requested shell state appears, five sections remain mounted, and the page has no more than 2px horizontal overflow. The workflow sets reduced motion.

This is **not authenticated learner acceptance** and cannot establish source ownership, real file access, actual grading, voice, keyboard, screen-reader fidelity, focus order, high-contrast or native-device success. Keep those gates open in `PHASE3_UI_CHANGE_LEDGER_2026-10-15.md`. Review the uploaded GitHub Actions artifact on the exact PR SHA before accepting layout changes. No credentials, learner screenshots, production data or secrets are captured.
