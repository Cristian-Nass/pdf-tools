"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  RotateCw,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Page = { thumb: string };

type Loaded = { file: File; pages: Page[] };

type Status =
  | { kind: "idle" }
  | { kind: "loading"; page: number; total: number }
  | { kind: "applying" }
  | { kind: "done"; name: string }
  | { kind: "error"; message: string };

// Longest edge of each rendered thumbnail (kept small; mobile-safe).
const THUMB_DIM = 180;

const RotatePdf: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [rotations, setRotations] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isBusy = status.kind === "loading" || status.kind === "applying";
  const anyRotated = rotations.some((r) => r !== 0);

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

    setLoaded(null);
    setRotations([]);
    setStatus({ kind: "loading", page: 0, total: 0 });

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data }).promise;
      const pages: Page[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        setStatus({ kind: "loading", page: i, total: doc.numPages });
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = THUMB_DIM / Math.max(base.width, base.height);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        pages.push({ thumb: canvas.toDataURL("image/jpeg", 0.7) });
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }

      setLoaded({ file, pages });
      setRotations(new Array(pages.length).fill(0));
      setStatus({ kind: "idle" });
    } catch (err) {
      console.error("Failed to load PDF:", err);
      setLoaded(null);
      setStatus({
        kind: "error",
        message: "Couldn’t read that PDF. It may be corrupted or protected.",
      });
    }
  };

  const reset = () => {
    setLoaded(null);
    setRotations([]);
    setStatus({ kind: "idle" });
  };

  const rotateOne = (index: number, delta: number) => {
    setRotations((prev) =>
      prev.map((r, i) => (i === index ? (((r + delta) % 360) + 360) % 360 : r)),
    );
    if (status.kind === "done") setStatus({ kind: "idle" });
  };

  const rotateAll = (delta: number) => {
    setRotations((prev) => prev.map((r) => (((r + delta) % 360) + 360) % 360));
    if (status.kind === "done") setStatus({ kind: "idle" });
  };

  const resetRotations = () => {
    setRotations((prev) => prev.map(() => 0));
    if (status.kind === "done") setStatus({ kind: "idle" });
  };

  const apply = async () => {
    if (!loaded || !anyRotated) return;
    setStatus({ kind: "applying" });

    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const doc = await PDFDocument.load(await loaded.file.arrayBuffer());
      doc.getPages().forEach((page, i) => {
        const delta = rotations[i] ?? 0;
        if (delta) {
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + delta) % 360));
        }
      });

      const bytes = await doc.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const outName = loaded.file.name.replace(/\.pdf$/i, "") + "-rotated.pdf";
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({ kind: "done", name: outName });
    } catch (err) {
      console.error("PDF rotate failed:", err);
      setStatus({
        kind: "error",
        message: "Something went wrong while rotating the PDF.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <RotateCw className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Rotate PDF</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a PDF, then turn pages one by one or all at once.
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
              {status.total
                ? `Loading pages… (${status.page}/${status.total})`
                : "Reading PDF…"}
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
                {loaded.pages.length}{" "}
                {loaded.pages.length === 1 ? "page" : "pages"}
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

          {/* Rotate-all controls */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">All pages:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => rotateAll(-90)}
              disabled={isBusy}
            >
              <RotateCcw />
              Left
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => rotateAll(90)}
              disabled={isBusy}
            >
              <RotateCw />
              Right
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetRotations}
              disabled={isBusy || !anyRotated}
            >
              <Undo2 />
              Reset
            </Button>
          </div>

          {/* Page grid */}
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {loaded.pages.map((page, i) => (
              <li
                key={i}
                className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-2"
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.thumb}
                    alt={`Page ${i + 1}`}
                    style={{ transform: `rotate(${rotations[i]}deg)` }}
                    className="max-h-[82%] max-w-[82%] object-contain shadow-sm transition-transform"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="pl-1 text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Rotate page ${i + 1} left`}
                      onClick={() => rotateOne(i, -90)}
                      disabled={isBusy}
                    >
                      <RotateCcw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Rotate page ${i + 1} right`}
                      onClick={() => rotateOne(i, 90)}
                      disabled={isBusy}
                    >
                      <RotateCw />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loaded && (
        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={apply}
          disabled={!anyRotated || isBusy}
        >
          {status.kind === "applying" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Rotating…
            </>
          ) : (
            <>
              <RotateCw className="size-4" />
              {anyRotated ? "Rotate & download" : "Rotate a page to start"}
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

export default RotatePdf;
