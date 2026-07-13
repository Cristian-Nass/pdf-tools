"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileDown,
  Loader2,
  Minimize2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Loaded = { file: File; pageCount: number; size: number };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "compressing"; page: number; total: number }
  | { kind: "done"; name: string; before: number; after: number }
  | { kind: "info"; message: string }
  | { kind: "error"; message: string };

type Level = "high" | "balanced" | "small";

const LEVELS: Record<
  Level,
  { label: string; hint: string; dpi: number; quality: number }
> = {
  high: { label: "Higher quality", hint: "Larger file", dpi: 144, quality: 0.8 },
  balanced: {
    label: "Recommended",
    hint: "Good balance",
    dpi: 110,
    quality: 0.65,
  },
  small: { label: "Smallest file", hint: "Lower quality", dpi: 84, quality: 0.5 },
};

// Keep any single canvas within mobile Safari's per-canvas pixel budget.
const MAX_CANVAS_DIM = 2600;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CompressPdf: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [level, setLevel] = useState<Level>("balanced");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isBusy = status.kind === "loading" || status.kind === "compressing";

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
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(await file.arrayBuffer());
      setLoaded({ file, pageCount: doc.getPageCount(), size: file.size });
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
    setStatus({ kind: "idle" });
  };

  const compress = async () => {
    if (!loaded) return;
    const { dpi, quality } = LEVELS[level];

    setStatus({ kind: "compressing", page: 0, total: loaded.pageCount });
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const { PDFDocument } = await import("pdf-lib");

      const data = new Uint8Array(await loaded.file.arrayBuffer());
      const src = await pdfjs.getDocument({ data }).promise;
      const out = await PDFDocument.create();

      for (let i = 1; i <= src.numPages; i++) {
        setStatus({ kind: "compressing", page: i, total: src.numPages });

        const page = await src.getPage(i);
        const base = page.getViewport({ scale: 1 }); // PDF points @ 72dpi

        let scale = dpi / 72;
        const maxSide = Math.max(base.width, base.height) * scale;
        if (maxSide > MAX_CANVAS_DIM) scale *= MAX_CANVAS_DIM / maxSide;

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        // Free the canvas immediately (mobile Safari won't otherwise).
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        if (!blob) throw new Error("Could not render a page.");

        const img = await out.embedJpg(await blob.arrayBuffer());
        const outPage = out.addPage([base.width, base.height]);
        outPage.drawImage(img, {
          x: 0,
          y: 0,
          width: base.width,
          height: base.height,
        });
      }

      const bytes = await out.save();

      if (bytes.byteLength >= loaded.size) {
        setStatus({
          kind: "info",
          message:
            "This PDF is already well-optimized (or mostly text), so compressing wouldn’t make it smaller. Left the original untouched.",
        });
        return;
      }

      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const outName = loaded.file.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({
        kind: "done",
        name: outName,
        before: loaded.size,
        after: bytes.byteLength,
      });
    } catch (err) {
      console.error("PDF compression failed:", err);
      setStatus({
        kind: "error",
        message: "Something went wrong while compressing the PDF.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Minimize2 className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Compress PDF</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Shrink a PDF’s file size. Best for scans and image-heavy documents.
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
                {loaded.pageCount} {loaded.pageCount === 1 ? "page" : "pages"} ·{" "}
                {formatSize(loaded.size)}
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

          <p className="mt-4 text-sm font-medium">Compression level</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {(Object.keys(LEVELS) as Level[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setLevel(key)}
                disabled={isBusy}
                className={cn(
                  "flex flex-col rounded-lg border px-2 py-2 text-left transition-colors disabled:opacity-50",
                  level === key
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                <span className="text-xs font-medium leading-tight">
                  {LEVELS[key].label}
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  {LEVELS[key].hint}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Pages are re-saved as images, so the text won’t be selectable or
            searchable afterward.
          </p>
        </div>
      )}

      {loaded && (
        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={compress}
          disabled={isBusy}
        >
          {status.kind === "compressing" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Compressing… ({status.page}/{status.total})
            </>
          ) : (
            <>
              <FileDown className="size-4" />
              Compress PDF
            </>
          )}
        </Button>
      )}

      {status.kind === "done" && (
        <div className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
          <p className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="size-4" />
            Downloaded “{status.name}”.
          </p>
          <p className="mt-1 text-muted-foreground">
            {formatSize(status.before)} → {formatSize(status.after)} (saved{" "}
            {Math.round((1 - status.after / status.before) * 100)}%)
          </p>
        </div>
      )}
      {status.kind === "info" && (
        <p className="mt-4 text-sm text-muted-foreground">{status.message}</p>
      )}
      {status.kind === "error" && (
        <p className="mt-4 text-sm text-destructive">{status.message}</p>
      )}
    </div>
  );
};

export default CompressPdf;
