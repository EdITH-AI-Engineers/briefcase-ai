# frameworks/

This directory holds the **frozen framework bundle** that grounds every analysis. `manifest.json` is the registry; individual `.md` files are the paraphrased source documents; `references.md` is the stable bibliographic appendix appended verbatim to every generated narrative.

## Contents

| File | Purpose |
| --- | --- |
| `manifest.json` | Registry of framework documents: id, version, file, canonical URL, publisher. Read by `src/context.ts`. |
| `references.md` | The stable References block appended verbatim to every per-student narrative. Do not edit per-run. |
| `assessment-slate.md` | Fixed 7-competency rubric + proficiency scale. Derived from the other docs; cited via `[slate:*]` only when the slate itself is the source. |
| `ched-cmo-25-s2015.md` | CHED CMO 25 s.2015 — PH program outcomes for BSCS / BSIT (paraphrased, OCR-verified). Applied to BSCS and BSIT profiles. |
| `ched-cmo-87-s2017.md` | CHED CMO 87 s.2017 — PH program outcomes for BS Computer Engineering (paraphrased, ABET EC-2000-aligned). Applied to BSCpE profiles. |
| `cc2020.md` | ACM/IEEE CC2020 — knowledge areas, competency dimensions, dispositions (canonical codes + paraphrased descriptors). |
| `sfia-9.md` | SFIA 9 — selected professional skill codes and responsibility scale (paraphrased; per-skill canonical URLs). |

## Clause IDs and citations

Each framework doc defines **clause IDs** that analysis output uses as citation tokens:

- `[ched-25:<clause>]` — e.g. `[ched-25:bscs-po-3]`, `[ched-25:bsit-po-5]`, `[ched-25:common-po-1]` (used for BSCS and BSIT profiles only)
- `[ched-87:<clause>]` — e.g. `[ched-87:bscpe-po-c]`, `[ched-87:bscpe-sp-iot]` (used for BSCpE profiles only — CMO 87 uses letter labels (a)–(l))
- `[cc2020:<clause>]` — e.g. `[cc2020:KA-SDF]`, `[cc2020:DISP-SELF]` (program-agnostic)
- `[sfia-9:<CODE>-<LEVEL>]` — e.g. `[sfia-9:PROG-3]` (program-agnostic)

Clause IDs for the CHED CMOs are this bundle's stable internal identifiers (not CHED's section numbering). CC2020 knowledge-area codes (SDF, DSA, SEC, etc.) are canonical to CC2020 and CS2013. SFIA skill codes (PROG, DATM, SCTY, etc.) are canonical to SFIA.

## Frozen-version discipline

The `bundleVersion` field in `manifest.json` identifies the exact combination of framework documents in use. When any framework doc is edited, bump the `bundleVersion`. The run's `manifest.json` records the bundle version used, so every narrative is traceable to the framework text in effect at generation time.

Do not paraphrase or rewrite the doc files casually — each edit is a version-significant change that affects every downstream narrative. If you are adding a new framework, create a new doc file, update `manifest.json`, bump `bundleVersion`, and append a new entry to `references.md`.

## Licensing notes

- **CHED CMO 25 s.2015** is a Philippine government memorandum order — public document, no licensing restriction on paraphrase or citation.
- **CC2020** is freely downloadable from ACM. Paraphrase is safe; direct large-block quotation would need ACM permission.
- **SFIA 9** is under the SFIA Foundation's Personal User Licence. This bundle paraphrases rather than quoting SFIA descriptors verbatim, and cites per-skill canonical URLs. Do not paste SFIA descriptor text unmodified into these files or into generated output.

## Swapping in a different framework stack

1. Drop your new framework doc into this directory.
2. Add an entry to `manifest.json` with a stable `id`, a `version`, the file path, the canonical `url`, and a paraphrase `note`.
3. Append a bibliographic entry to `references.md`.
4. Bump `bundleVersion` in `manifest.json`.
5. Design clause IDs that will serve as citation tokens; document them in the doc's "How to cite" section.

No code changes are required — `src/context.ts` reads the manifest and concatenates whatever docs are listed.

## Token-count note

Context caching activates only when the system instruction (role brief + framework bundle + evaluation rules) clears 1024 tokens — Gemini's Flash-tier minimum. The default bundle (CHED 25 + CC2020 + SFIA 9 slice) is comfortably above that. On Gemini free tier the `caches.create` call will still fail with `RESOURCE_EXHAUSTED limit=0`; the runner catches this and proceeds without caching.
