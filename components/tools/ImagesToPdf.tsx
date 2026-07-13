"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PickedImage = { id: string; file: File; url: string };

type Status =
  | { kind: "idle" }
  | { kind: "converting" }
  | { kind: "done"; name: string }
  | { kind: "error"; message: string };

// A4 in PDF points (72 dpi).
const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 24;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const loadImageElement = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image."));
    img.src = url;
  });

// Cap the longest edge. Keeps every canvas well under mobile Safari's per-canvas
// pixel limit while still leaving ~260 dpi on an A4 page.
const MAX_DIM = 2000;

// Draw the image onto a (downscaled) canvas and hand back JPEG bytes that
// pdf-lib can embed. Doing this for *every* image normalizes formats
// (incl. HEIC/WebP that the browser can decode but pdf-lib can't) and, crucially
// on mobile, we release the canvas immediately so the next image doesn't hit
// the OS canvas-memory cap — the cause of the "second image fails" error.
const renderToJpegBytes = async (file: File): Promise<Uint8Array> => {
  const url = URL.createObjectURL(file);
  let canvas: HTMLCanvasElement | null = null;
  try {
    const img = await loadImageElement(url);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) throw new Error("Image has no dimensions.");

    const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported.");
    // Flatten any transparency onto white so PDF pages don't show black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas!.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) throw new Error("Could not encode image.");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    // Free the canvas backing store right away — mobile Safari won't otherwise.
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    URL.revokeObjectURL(url);
  }
};

const ImagesToPdf: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isConverting = status.kind === "converting";

  // Revoke any remaining thumbnail URLs when the component unmounts.
  useEffect(() => {
    return () => {
      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.url));
        return prev;
      });
    };
  }, []);

  const openPicker = () => {
    if (isConverting) return;
    inputRef.current?.click();
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // Reset so selecting the same file again still fires onChange.
    event.target.value = "";

    const imageFiles = picked.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length !== picked.length) {
      setStatus({ kind: "error", message: "Only image files can be added." });
    } else if (status.kind !== "converting") {
      setStatus({ kind: "idle" });
    }

    setImages((prev) => [
      ...prev,
      ...imageFiles.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((img) => img.id !== id);
    });
    setStatus({ kind: "idle" });
  };

  const move = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const clearAll = () => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return [];
    });
    setStatus({ kind: "idle" });
  };

  const convert = async () => {
    if (images.length === 0) return;
    setStatus({ kind: "converting" });

    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create();

      for (const { file } of images) {
        let embedded;
        try {
          // Normalize + downscale every image to a JPEG the browser produced.
          embedded = await pdf.embedJpg(await renderToJpegBytes(file));
        } catch {
          // Fallback: embed the original bytes directly (e.g. if canvas failed
          // but pdf-lib can still read the file as-is).
          try {
            const bytes = await file.arrayBuffer();
            embedded =
              file.type === "image/png"
                ? await pdf.embedPng(bytes)
                : await pdf.embedJpg(bytes);
          } catch {
            throw new Error(`Couldn’t add “${file.name}”. Try a JPG or PNG.`);
          }
        }

        const page = pdf.addPage([PAGE.w, PAGE.h]);
        const maxW = PAGE.w - MARGIN * 2;
        const maxH = PAGE.h - MARGIN * 2;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        page.drawImage(embedded, {
          x: (PAGE.w - w) / 2,
          y: (PAGE.h - h) / 2,
          width: w,
          height: h,
        });
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const outName = "images.pdf";
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({ kind: "done", name: outName });
    } catch (err) {
      console.error("Images -> PDF conversion failed:", err);
      setStatus({
        kind: "error",
        message:
          err instanceof Error && err.message.startsWith("Couldn’t add")
            ? err.message
            : "Something went wrong. One of the images may be unreadable.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ImageIcon className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Images to PDF</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add JPG, PNG, or other images, arrange them in order, and download them
        as a single PDF — one image per page.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {images.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          className="mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/60"
        >
          <Plus className="size-6" />
          <span className="text-sm font-medium">Select images</span>
          <span className="text-xs">JPG, PNG and more — pick several at once</span>
        </button>
      ) : (
        <ul className="mt-6 w-full space-y-2 text-left">
          {images.map(({ id, file, url }, index) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border bg-background p-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                {index + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="size-10 shrink-0 rounded-md border object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move up"
                onClick={() => move(index, -1)}
                disabled={index === 0 || isConverting}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move down"
                onClick={() => move(index, 1)}
                disabled={index === images.length - 1 || isConverting}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeImage(id)}
                disabled={isConverting}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <div className="mt-3 flex w-full items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={openPicker}
            disabled={isConverting}
          >
            <Plus />
            Add more
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={isConverting}
          >
            Clear all
          </Button>
        </div>
      )}

      <Button
        className="mt-4 w-full"
        size="lg"
        onClick={convert}
        disabled={images.length === 0 || isConverting}
      >
        {isConverting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Building PDF…
          </>
        ) : (
          <>
            <ImageIcon className="size-4" />
            {images.length === 0
              ? "Add images to start"
              : `Create PDF from ${images.length} ${
                  images.length === 1 ? "image" : "images"
                }`}
          </>
        )}
      </Button>

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

export default ImagesToPdf;
