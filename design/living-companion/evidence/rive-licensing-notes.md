# Rive licensing and export notes (research, 2026-11-16)

Accessed 2026-11-16. A later system date notice in the session reads 2026-11-17; the content below reflects pages read during this session. No accounts were created, nothing was signed into, nothing was purchased, and no git commands were run.

## Summary

- Commercial .riv export on the Free tier: COULD NOT VERIFY. Free can export for runtime, but the output plays a Rive splash screen, and no official text found permits or bars shipping those files commercially.
- Lowest plan without the splash screen: Cadet. Price is $9/seat/month billed yearly (pricing page) or $17/seat/month monthly (docs). Enterprise is required above USD $10M annual gross revenue (ToS C.6, including parent and affiliate entities).
- You own your User Content (ToS D.4). No clause restricting commercial use of exported files was found; whether an exported .riv counts as User Content is NOT FOUND.
- Web, iOS and Android runtimes are MIT, copyright Rive. Web sizes (brotli -9): canvas-lite 222 KB, canvas 567 KB, webgl2 648 KB. Gzip sizes not verified.
- Not verified: runtime telemetry or network calls, licenses of runtime third-party dependencies, CLI 1.9.x version and CLI license, and any child-specific term for end-user apps.

## Method and evidence classes

Official pages were read with a summarizing fetch tool, so quoted text is as returned by that tool and should be checked against the live page before any legal reliance. Evidence classes used below:
- (a) Verified: from a Rive official page or a raw LICENSE file.
- (b) Third-party only: seen only in search results or non-Rive sites.
- (c) NOT VERIFIED: searched, not found, or the page could not be read (403, 404).

## Findings

### 1. Plans and prices

- Finding: Plans are Free, Cadet, Voyager and Enterprise, plus a Student plan (price NOT FOUND; the page says it is "not for commercial use or team collaboration"). The pricing page shows one per-seat price per plan with a YEARLY/MONTHLY toggle: Free $0, Cadet $9, Voyager $32, Enterprise $120 (all per seat per month). The account pricing docs list monthly and yearly figures: Cadet $17/seat/month or $108/seat/year; Voyager $49/seat/month or $384/seat/year; Enterprise $1,440/seat/year (Enterprise monthly NOT FOUND). Seat caps from the docs: Cadet 3, Voyager 25. Enterprise is for organizations above $10M annual revenue. The two price sets reconcile if the pricing page shows yearly-billed monthly equivalents (9 x 12 = 108, 32 x 12 = 384, 120 x 12 = 1,440). That reconciliation is my inference; Rive does not state it on these pages. The 2023 blog post (Pro and Team plans) is superseded and was not used.
- Source: https://rive.app/pricing ; https://rive.app/docs/account-admin/pricing ; https://rive.app/blog/new-pricing (2023, superseded)
- Confidence: (a) for plan names and listed prices; medium-high. The price reconciliation is an inference. A third-party page (https://vijaytalksai.com/rive-pricing-explained/) repeats Cadet at $9 per seat and is (b) only.

### 2. Can the Free tier export .riv files?

- Finding: Yes, with a splash screen. Docs: "Exports for runtime, with a Rive splash screen." Pricing page: "Free exports play a Rive splash screen." Export is not disabled. Other Free limits from the pricing page summary: 1 project, 3 collaborative files, 50 publishes and pushes per month, 10 MB per imported asset (100 MB on paid plans). The "limited number of files with export limits" wording in the 2023 blog is not specified there, so exact older export limits are NOT FOUND. No watermark other than the splash screen was found on the pricing or export pages. "Made with Rive" requirement: NOT FOUND.
- CLI note: a clean, unwatermarked build needs a workspace on Cadet or higher. Quoted: "writes a `.riv` with no watermark when the Workspace" and "is on the Cadet plan or higher." Otherwise, per the same page, "it adds a watermark." So CLI builds on Free may be watermarked.
- Source: https://rive.app/docs/editor/exporting/exporting-for-runtime ; https://rive.app/pricing ; https://rive.app/docs/cli/getting-started
- Confidence: (a) for splash screen and CLI watermark rule. Free file and asset limits: medium (summarized fetch).

### 3. Lowest plan for a shipped commercial product

- Finding: Cadet is the lowest plan that exports without the splash screen. Pricing page: "Export .riv files without the splash screen." Docs: "Exports for runtime without the splash screen." Revenue threshold, verbatim from ToS C.6: "If you (or your organization, including any parent or affiliate entities) have annual gross revenues exceeding USD $10 million, you may only use the Services under our Enterprise plan." Cadet seat cap is 3. Rive states, in the pricing page general section and the 2023 blog footer, "no revenue share, no runtime fees, no royalties" and "Open-source runtimes, no royalties or runtime fees" (the summary of the pricing page did not give a verbatim quote for the first; the blog footer is the same statement). No per-seat restriction on shipped products was found.
- Source: https://rive.app/pricing ; https://rive.app/docs/account-admin/pricing ; https://rive.app/docs/legal/terms-of-service (C.6) ; https://rive.app/blog/new-pricing (footer)
- Confidence: (a) for the Cadet splash-screen rule and the C.6 $10M rule. No explicit grant of commercial shipping rights for Cadet exports was found (NOT FOUND); none of the pages restricts it.

### 4. Ownership and commercial use of exported content

- Finding: ToS D.4: "As between you and Rive, you own your User Content." D.5(a) grants Rive a license "to store" content to provide the Service; D.5(b): "This license does not grant Rive the right to sell your User Content." Section E: "You agree that you obtain no intellectual property rights other than the limited licenses" (applies to Rive IP). NOT FOUND: any term saying whether an exported .riv file is User Content; any term describing Rive's rights in runtime or format elements embedded in an exported file; any restriction on commercial use of exports or on distributing them inside products (sections C, D, E and F searched; F incorporates an external Acceptable Use Policy). The ToS page shows "Last Updated: May 20, 2026." A community-hosted copy of the ToS (search result only) gives a different date and address; the rive.app/docs copy is the one read.
- Source: https://rive.app/docs/legal/terms-of-service ; https://rive.app/community/doc/terms-of-service/docG7vv2lLg8 (search result only)
- Confidence: (a) for quoted clauses (summarized fetch; check raw text). Exported-file ownership and commercial-use restrictions: NOT FOUND.

### 5. Runtime licenses and attribution

- Finding: All three runtime repos read were MIT.
  - rive-wasm (web): "MIT License", "Copyright (c) 2020-2021 Rive".
  - rive-ios: "MIT License", "Copyright (c) 2020 Rive".
  - rive-android: "MIT License", "Copyright (c) 2020-2024 Rive".
  MIT requires the copyright and permission notice to be included in all copies or substantial portions. No other attribution duty appears in the text. How that applies to compiled binaries in an app is a question for counsel.
- Dependencies: the runtime-sizes page names HarfBuzz, Miniaudio, SheenBidi, Yoga and Luau as C++ runtime dependencies. Their licenses were NOT VERIFIED. The React wrapper repo (https://github.com/rive-app/rive-react-canvas) returned 404, so its license is NOT VERIFIED. npm package pages (@rive-app/canvas, @rive-app/webgl2) returned 403, so npm license fields are NOT VERIFIED. A Gitee mirror and a Maven page (search results only) list rive-android as MIT.
- Source: https://raw.githubusercontent.com/rive-app/rive-wasm/master/LICENSE ; https://raw.githubusercontent.com/rive-app/rive-ios/master/LICENSE ; https://raw.githubusercontent.com/rive-app/rive-android/master/LICENSE ; https://rive.app/docs/runtimes/runtime-sizes
- Confidence: (a) for the three MIT LICENSE files. Dependency licenses: NOT VERIFIED.

### 6. Children, age limits, telemetry and runtime network calls

- Finding: ToS A.3: "You may use the Services only if you are 13 years or older and are not barred from using the Services under applicable law." This applies to people using Rive's Services (editor accounts). Privacy policy (last reviewed May 7, 2026): "The Service is not directed to individuals under 13." and "We do not knowingly collect personal information from children under 13." The privacy policy covers the website and the Product; it does not mention runtimes or apps built with Rive. Users under 16: NOT FOUND. COPPA: NOT FOUND. Acceptable Use Policy: no restriction on minors, child-directed apps, or distribution of exported content was found. Runtime telemetry: NOT FOUND in any official page. Runtime network calls: the rive-wasm README mentions no telemetry and no runtime network calls, but links to a "Loading Assets" page that was not read. The CLI docs say unsigned scripts are rejected by "the CDN and web runtimes," which suggests the web runtime may fetch from a Rive CDN; what it requests was NOT VERIFIED. Whether the age-13 Services bar reaches end users of a shipped app, and the studio's own COPPA duties for a child-directed app, are legal questions outside what Rive's pages state.
- Source: https://rive.app/docs/legal/terms-of-service (A.3) ; https://rive.app/docs/legal/privacy-policy ; https://rive.app/docs/legal/acceptable-use-policy ; https://github.com/rive-app/rive-wasm ; https://rive.app/docs/cli/getting-started
- Confidence: (a) for quoted age and privacy text. Runtime telemetry and network behavior: NOT VERIFIED; needs a test build inspected in browser developer tools.

### 7. Runtime size (web and mobile)

- Finding: Official runtime-sizes page, compression "Using: `brotli -9` for compression." Web: canvas-lite 707 KB uncompressed / 222 KB compressed; canvas 1728 KB / 567 KB; webgl2 2179 KB / 648 KB. "The majority of the size is the WASM library." Mobile (download and install impact, no compression stated): Android ARM-v8a 2.40 MB download / 7.03 MB install; Apple universal about 1.67 MB / 4.66 MB. Lite variant: a search summary of Rive's canvas-vs-webgl material says canvas-lite drops text, layout, audio and scripting engines, and that it avoids a separate WASM request at the cost of a larger JS bundle. That page was not fetched; treat as (b). Gzip sizes: NOT VERIFIED (npm pages returned 403). A third-party listing (https://depscope.dev/pkg/npm/@rive-app/canvas) gives @rive-app/canvas 147.2 KB minified and 42.5 KB gzipped, likely JS only; (b), unverified.
- Source: https://rive.app/docs/runtimes/runtime-sizes ; https://rive.app/docs/runtimes/web/canvas-vs-webgl (search summary only)
- Confidence: (a) for brotli figures. Gzip: NOT VERIFIED.

### 8. Rive CLI 1.9.x

- Finding: Version 1.9.x: NOT FOUND in any official page read. Run `rive --version` locally to confirm the installed build. Official CLI facts (getting-started): building runs locally with no login ("Everything else runs locally and works signed out and offline."). `--publish` needs an account and "creates a signed `.riv`" through Rive's API. Web scripts must be built with `--publish` because unsigned scripts are rejected by the CDN and web runtimes. A clean output needs a Cadet-or-higher workspace (see item 2). `--once`: NOT FOUND on the official pages read (a search snippet described it as writing unsigned output; unverified). CLI license: NOT FOUND. CLI telemetry: NOT FOUND. Relevance: CLI output on Free may carry a watermark, and signed web builds depend on Rive's API at build time.
- Source: https://rive.app/docs/cli/overview ; https://rive.app/docs/cli/getting-started
- Confidence: (a) for getting-started rules. Version and CLI license: NOT FOUND.

## Unresolved questions for the owner

1. Confirm the live pricing page. The two official pages show different monthly figures (Cadet $9 vs $17). Check which billing toggle applies and whether Enterprise has a monthly price.
2. Get written confirmation from Rive support or sales that Cadet-exported .riv files (no splash screen) may ship in a commercial children's app with no further fees or attribution beyond the MIT notices.
3. Revenue check: is annual gross revenue, including parent and affiliate entities, at or below USD $10M? If above, ToS C.6 requires Enterprise.
4. Confirm whether an exported .riv counts as User Content under D.4 and whether Rive keeps any license over the file after export.
5. Read the raw ToS and Acceptable Use Policy text directly; the notes above rely on summarized fetches.
6. Children: take counsel's view on COPPA and age-gating for a child-directed app. Rive's age-13 bar (A.3) covers Rive account holders; confirm it does not restrict end users of a shipped app.
7. Runtime network: build a test page, open browser developer tools, and record every request the runtime makes. Confirm whether it contacts a Rive CDN and whether that is acceptable for a child-directed app.
8. Gzip sizes: measure the shipped JS and WASM with a real build (not run during this research).
9. Dependency licenses: check HarfBuzz, Miniaudio, SheenBidi, Yoga and Luau licenses, and include all required notices for each target (web, iOS, Android).
10. Run `rive --version` to confirm the installed CLI build, since 1.9.x could not be confirmed. Confirm whether `--once` exists and what it writes.
11. Decide whether lite runtime variants are acceptable: confirm that the character needs no text, layout, audio or scripting features before choosing canvas-lite.

## Sources

Official (rive.app and GitHub raw files, read this session):
- https://rive.app/pricing
- https://rive.app/docs/account-admin/pricing
- https://rive.app/docs/editor/exporting/exporting-for-runtime
- https://rive.app/docs/legal/terms-of-service
- https://rive.app/docs/legal/privacy-policy
- https://rive.app/docs/legal/acceptable-use-policy (fetched; no restriction found)
- https://rive.app/docs/runtimes/runtime-sizes
- https://rive.app/docs/cli/overview
- https://rive.app/docs/cli/getting-started
- https://rive.app/blog/new-pricing (dated July 31, 2023; superseded plan names)
- https://github.com/rive-app/rive-wasm
- https://raw.githubusercontent.com/rive-app/rive-wasm/master/LICENSE
- https://raw.githubusercontent.com/rive-app/rive-ios/master/LICENSE
- https://raw.githubusercontent.com/rive-app/rive-android/master/LICENSE

Official, not readable (errors):
- https://github.com/rive-app/rive-react-canvas (404)
- https://www.npmjs.com/package/@rive-app/canvas (403)
- https://www.npmjs.com/package/@rive-app/webgl2 (403)

Search results or third-party only (class b, not relied on for conclusions):
- https://rive.app/community/doc/terms-of-service/docG7vv2lLg8
- https://rive.app/docs/runtimes/web/canvas-vs-webgl (search summary)
- https://rive.app/docs/cli/reference/commands (search result, not read)
- https://vijaytalksai.com/rive-pricing-explained/
- https://depscope.dev/pkg/npm/@rive-app/canvas
- https://socket.dev/npm/package/@rive-app/canvas-lite (search result, not read)
- https://mvnrepository.com/artifact/app.rive/rive-android/10.5.1 (search result, not read)
- https://gitee.com/ggbhack/rive-ios (mirror, search result)
