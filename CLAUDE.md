@AGENTS.md

# PDF Tools

A **fully client-side** PDF toolbox (Next.js 16 App Router, React 19, Tailwind v4, shadcn/base-ui). Every conversion runs in the browser — files never leave the user's device. There is no backend or API route.

## Tools

A single tabbed UI ([components/PdfTools.tsx](components/PdfTools.tsx)) switches between seven tools, each a self-contained client component in [components/tools/](components/tools/). Tab order is defined by the `tabs` array; the default tab is `create`. The tab bar is `grid-cols-4` on mobile / `grid-cols-7` on `sm+`, inside a `max-w-2xl` container.

| Tool | File | Libraries | Notes |
| --- | --- | --- | --- |
| Create PDF | `CreatePdf.tsx` | pdf-lib | Type/paste text → PDF. Page size, font (Helvetica/Times/Courier standard fonts, no embedding), size, bold/italic, alignment, line spacing. Custom wrap/paginate/align layout engine; sanitizes pasted text and swaps unencodable chars for `?`. Preview opens in a `Dialog`. |
| Word → PDF | `DocxToPdf.tsx` | mammoth, html-to-pdfmake, pdfmake | DOCX → HTML → pdfmake. Fidelity is limited (loses tables/images/most styling). |
| Images → PDF | `ImagesToPdf.tsx` | pdf-lib | JPG/PNG/others → one image per A4 page. |
| Merge PDFs | `MergePdf.tsx` | pdf-lib | Multi-select, reorder, remove; `copyPages` into one doc. |
| Split PDF | `SplitPdf.tsx` | pdf-lib | Extracts a page selection (`1-3, 5, 8-10`) into one new PDF. Output only, v1. |
| Rotate PDF | `RotatePdf.tsx` | pdfjs-dist, pdf-lib | Renders a thumbnail per page; rotate pages individually or all at once, then apply. Deltas stack onto each page's existing rotation. |
| Compress PDF | `CompressPdf.tsx` | pdfjs-dist, pdf-lib | Rasterizes each page → JPEG → rebuilds. **Lossy: text stops being selectable.** Refuses results larger than the original. |

## Conventions

- **Every tool is `"use client"`** and dynamically `import()`s its heavy libraries inside the handler (keeps them out of the initial bundle). Follow this pattern for new tools.
- **Downloads** use the Blob + object-URL + `<a>.click()` pattern (see MergePdf/SplitPdf), except pdfmake which has its own `.download()`.
- **Status is a discriminated union** (`{ kind: "idle" | "converting" | "done" | "error" | ... }`) driving the UI. Reuse this shape.
- **Consistent tool layout**: icon badge → `<h2>` title → description → picker/dropzone → action `<Button>` → success (emerald + `CheckCircle2`) / error (`text-destructive`) message.
- **File lists** (merge/images) use `{ id, file }` items with numbered rows, up/down reorder, and per-row remove.
- **UI primitives** live in [components/ui/](components/ui/) as thin shadcn-style wrappers over `@base-ui/react` (`button.tsx`, `dialog.tsx`). `dialog.tsx` is full-screen on mobile and a centered modal on `sm+`; reuse it rather than hand-rolling modals.

## Mobile / canvas rules (important)

Mobile Safari caps per-canvas pixels and is slow to free canvas memory, which caused a "second image fails" bug. Any code that draws to a `<canvas>` MUST:

1. **Downscale** so the longest edge stays under `MAX_CANVAS_DIM` (~2000–2600px).
2. **Release the canvas immediately** after use: `canvas.width = 0; canvas.height = 0;`.
3. Wrap per-file work so a failure names the file instead of failing the whole batch.

See `renderToJpegBytes` in `ImagesToPdf.tsx` and the render loops in `CompressPdf.tsx` and `RotatePdf.tsx`.

## pdf.js worker

Tools that render PDFs (`CompressPdf.tsx`, `RotatePdf.tsx`) set the worker via `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` — Turbopack bundles it as an asset. Don't switch this to a CDN URL (breaks the offline/privacy guarantee).

## Verifying changes

`npx tsc --noEmit`, `npx eslint components/`, and `npm run build` should all be clean. Pure `pdf-lib` logic (Create/Merge/Split/Rotate math) can be sanity-checked headlessly with a throwaway Node script, but the canvas/pdf.js render paths and the preview iframe can't — test those in a real browser (and on a phone for the image/compress/rotate tools).
