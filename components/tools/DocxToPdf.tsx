"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "converting"; name: string }
  | { kind: "done"; name: string }
  | { kind: "error"; message: string };

const DocxToPdf: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isConverting = status.kind === "converting";

  const openPicker = () => {
    if (isConverting) return;
    inputRef.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again still fires onChange.
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setStatus({ kind: "error", message: "Please choose a .docx file." });
      return;
    }

    setStatus({ kind: "converting", name: file.name });

    try {
      const arrayBuffer = await file.arrayBuffer();

      // DOCX -> HTML
      const mammoth = await import("mammoth/mammoth.browser");
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

      // HTML -> pdfmake content
      const htmlToPdfmakeModule = await import("html-to-pdfmake");
      const htmlToPdfmake = htmlToPdfmakeModule.default ?? htmlToPdfmakeModule;
      const content = htmlToPdfmake(html, { window });

      // pdfmake (browser build + embedded Roboto fonts)
      const pdfMakeModule = await import("pdfmake/build/pdfmake");
      const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
      const vfsModule = await import("pdfmake/build/vfs_fonts");
      pdfMake.vfs = vfsModule.default ?? vfsModule;

      const outName = file.name.replace(/\.docx$/i, ".pdf");
      pdfMake
        .createPdf({ content, defaultStyle: { font: "Roboto" } })
        .download(outName);

      setStatus({ kind: "done", name: outName });
    } catch (err) {
      console.error("DOCX -> PDF conversion failed:", err);
      setStatus({
        kind: "error",
        message: "Something went wrong while converting the file.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Word to PDF</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a Word (.docx) file and download it as a PDF.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFile}
      />

      <Button
        className="mt-6 w-full"
        size="lg"
        onClick={openPicker}
        disabled={isConverting}
      >
        {isConverting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Converting…
          </>
        ) : (
          <>
            <Upload className="size-4" />
            Select Word file
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

export default DocxToPdf;
