@AGENTS.md

# PDF Tools

A **fully client-side** PDF toolbox (Next.js 16 App Router, React 19, Tailwind v4, shadcn/base-ui). Every conversion runs in the browser — files never leave the user's device. There is no backend or API route.

## Tools

A single tabbed UI ([components/PdfTools.tsx](components/PdfTools.tsx)) switches between five tools, each a self-contained client component in [components/tools/](components/tools/):

| Tool | File | Libraries | Notes |
| --- | --- | --- | --- |
| Word → PDF | `DocxToPdf.tsx` | mammoth, html-to-pdfmake, pdfmake | DOCX → HTML → pdfmake. Fidelity is limited (loses tables/images/most styling). |
| Merge PDFs | `MergePdf.tsx` | pdf-lib | Multi-select, reorder, remove; `copyPages` into one doc. |
| Split PDF | `SplitPdf.tsx` | pdf-lib | Extracts a page selection (`1-3, 5, 8-10`) into one new PDF. Output only, v1. |
| Compress PDF | `CompressPdf.tsx` | pdfjs-dist, pdf-lib | Rasterizes each page → JPEG → rebuilds. **Lossy: text stops being selectable.** Refuses results larger than the original. |
| Images → PDF | `ImagesToPdf.tsx` | pdf-lib | JPG/PNG/others → one image per A4 page. |

## Conventions

- **Every tool is `"use client"`** and dynamically `import()`s its heavy libraries inside the handler (keeps them out of the initial bundle). Follow this pattern for new tools.
- **Downloads** use the Blob + object-URL + `<a>.click()` pattern (see MergePdf/SplitPdf), except pdfmake which has its own `.download()`.
- **Status is a discriminated union** (`{ kind: "idle" | "converting" | "done" | "error" | ... }`) driving the UI. Reuse this shape.
- **Consistent tool layout**: icon badge → `<h2>` title → description → picker/dropzone → action `<Button>` → success (emerald + `CheckCircle2`) / error (`text-destructive`) message.
- **File lists** (merge/images) use `{ id, file }` items with numbered rows, up/down reorder, and per-row remove.

## Mobile / canvas rules (important)

Mobile Safari caps per-canvas pixels and is slow to free canvas memory, which caused a "second image fails" bug. Any code that draws to a `<canvas>` MUST:

1. **Downscale** so the longest edge stays under `MAX_CANVAS_DIM` (~2000–2600px).
2. **Release the canvas immediately** after use: `canvas.width = 0; canvas.height = 0;`.
3. Wrap per-file work so a failure names the file instead of failing the whole batch.

See `renderToJpegBytes` in `ImagesToPdf.tsx` and the render loop in `CompressPdf.tsx`.

## pdf.js worker

`CompressPdf.tsx` sets the worker via `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` — Turbopack bundles it as an asset. Don't switch this to a CDN URL (breaks the offline/privacy guarantee).

## Verifying changes

`npx tsc --noEmit`, `npx eslint components/`, and `npm run build` should all be clean. The canvas/pdf.js render paths can't be exercised headlessly — test those in a real browser (and on a phone for the image/compress tools).
