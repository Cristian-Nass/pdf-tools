"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Layers,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PickedFile = { id: string; file: File };

type Status =
  | { kind: "idle" }
  | { kind: "merging" }
  | { kind: "done"; name: string }
  | { kind: "error"; message: string };

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MergePdf: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isMerging = status.kind === "merging";

  const openPicker = () => {
    if (isMerging) return;
    inputRef.current?.click();
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // Reset so selecting the same file again still fires onChange.
    event.target.value = "";

    const pdfs = picked.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length !== picked.length) {
      setStatus({ kind: "error", message: "Only PDF files can be merged." });
    } else if (status.kind !== "merging") {
      setStatus({ kind: "idle" });
    }

    setFiles((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
      })),
    ]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setStatus({ kind: "idle" });
  };

  const move = (index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const clearAll = () => {
    setFiles([]);
    setStatus({ kind: "idle" });
  };

  const merge = async () => {
    if (files.length < 2) return;
    setStatus({ kind: "merging" });

    try {
      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();

      for (const { file } of files) {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }

      const mergedBytes = await merged.save();
      const blob = new Blob([mergedBytes as BlobPart], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const outName = "merged.pdf";
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({ kind: "done", name: outName });
    } catch (err) {
      console.error("PDF merge failed:", err);
      setStatus({
        kind: "error",
        message:
          "Something went wrong. One of the files may be corrupted or password-protected.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Layers className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Merge PDFs</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add two or more PDFs, arrange them in the order you want, and download a
        single combined PDF.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {files.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          className="mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/60"
        >
          <Plus className="size-6" />
          <span className="text-sm font-medium">Select PDF files</span>
          <span className="text-xs">You can pick several at once</span>
        </button>
      ) : (
        <ul className="mt-6 w-full space-y-2 text-left">
          {files.map(({ id, file }, index) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border bg-background p-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                {index + 1}
              </span>
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
                disabled={index === 0 || isMerging}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move down"
                onClick={() => move(index, 1)}
                disabled={index === files.length - 1 || isMerging}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(id)}
                disabled={isMerging}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="mt-3 flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" onClick={openPicker} disabled={isMerging}>
            <Plus />
            Add more
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={isMerging}>
            Clear all
          </Button>
        </div>
      )}

      <Button
        className="mt-4 w-full"
        size="lg"
        onClick={merge}
        disabled={files.length < 2 || isMerging}
      >
        {isMerging ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Merging…
          </>
        ) : (
          <>
            <Layers className="size-4" />
            {files.length < 2
              ? "Add at least 2 PDFs"
              : `Merge ${files.length} PDFs`}
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

export default MergePdf;
