"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Scissors, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Loaded = { file: File; pageCount: number };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "splitting" }
  | { kind: "done"; name: string }
  | { kind: "error"; message: string };

type ParseResult =
  | { ok: true; indices: number[] }
  | { ok: false; message: string };

// Parse a selection like "1-3, 5, 8-10" into 0-based page indices, in order.
const parseSelection = (input: string, pageCount: number): ParseResult => {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { ok: false, message: "Enter the pages you want, e.g. 1-3, 5." };
  }

  const indices: number[] = [];
  for (const token of tokens) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) {
      return { ok: false, message: `“${token}” isn’t a valid page or range.` };
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;

    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      return {
        ok: false,
        message: `Pages must be between 1 and ${pageCount}.`,
      };
    }

    if (start <= end) {
      for (let p = start; p <= end; p++) indices.push(p - 1);
    } else {
      for (let p = start; p >= end; p--) indices.push(p - 1);
    }
  }

  return { ok: true, indices };
};

const SplitPdf: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selection, setSelection] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isBusy = status.kind === "loading" || status.kind === "splitting";

  const parsed = useMemo<ParseResult | null>(
    () => (loaded ? parseSelection(selection, loaded.pageCount) : null),
    [loaded, selection],
  );

  const openPicker = () => {
    if (isBusy) return;
    inputRef.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setStatus({ kind: "error", message: "Please choose a PDF file." });
      return;
    }

    setStatus({ kind: "loading" });
    setSelection("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(await file.arrayBuffer());
      setLoaded({ file, pageCount: doc.getPageCount() });
      setStatus({ kind: "idle" });
    } catch (err) {
      console.error("Failed to read PDF:", err);
      setLoaded(null);
      setStatus({
        kind: "error",
        message: "Couldn’t read that PDF. It may be corrupted or protected.",
      });
    }
  };

  const reset = () => {
    setLoaded(null);
    setSelection("");
    setStatus({ kind: "idle" });
  };

  const split = async () => {
    if (!loaded || !parsed || !parsed.ok) return;
    setStatus({ kind: "splitting" });

    try {
      const { PDFDocument } = await import("pdf-lib");
      const source = await PDFDocument.load(await loaded.file.arrayBuffer());
      const out = await PDFDocument.create();
      const pages = await out.copyPages(source, parsed.indices);
      pages.forEach((page) => out.addPage(page));

      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const outName = loaded.file.name.replace(/\.pdf$/i, "") + "-extract.pdf";
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({ kind: "done", name: outName });
    } catch (err) {
      console.error("PDF split failed:", err);
      setStatus({
        kind: "error",
        message: "Something went wrong while splitting the PDF.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Scissors className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Split PDF</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a PDF and pull out the pages you want into a new file.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFile}
      />

      {!loaded ? (
        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={openPicker}
          disabled={isBusy}
        >
          {status.kind === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Reading PDF…
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Select PDF file
            </>
          )}
        </Button>
      ) : (
        <div className="mt-6 w-full text-left">
          <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{loaded.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {loaded.pageCount} {loaded.pageCount === 1 ? "page" : "pages"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Choose a different file"
              onClick={reset}
              disabled={isBusy}
            >
              <X />
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label htmlFor="page-selection" className="text-sm font-medium">
              Pages to extract
            </label>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setSelection(`1-${loaded.pageCount}`)}
              disabled={isBusy}
            >
              Select all
            </button>
          </div>
          <input
            id="page-selection"
            type="text"
            inputMode="numeric"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            placeholder="e.g. 1-3, 5, 8-10"
            disabled={isBusy}
            className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <p className="mt-1.5 h-4 text-xs">
            {selection.trim() === "" ? (
              <span className="text-muted-foreground">
                Use commas for individual pages and “-” for ranges.
              </span>
            ) : parsed?.ok ? (
              <span className="text-muted-foreground">
                Will create a PDF with {parsed.indices.length}{" "}
                {parsed.indices.length === 1 ? "page" : "pages"}.
              </span>
            ) : (
              <span className="text-destructive">{parsed?.message}</span>
            )}
          </p>
        </div>
      )}

      {loaded && (
        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={split}
          disabled={!parsed?.ok || isBusy}
        >
          {status.kind === "splitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Splitting…
            </>
          ) : (
            <>
              <Scissors className="size-4" />
              Extract pages
            </>
          )}
        </Button>
      )}

      {status.kind === "done" && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          Downloaded “{status.name}”.
        </p>
      )}
      {status.kind === "error" && (
        <p className="mt-4 text-sm text-destructive">{status.message}</p>
      )}
    </div>
  );
};

export default SplitPdf;
