"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "converting"; page: number; total: number }
  | { kind: "done"; name: string }
  | { kind: "error"; message: string };

// Keep each rasterized page within mobile Safari's per-canvas pixel budget.
const MAX_CANVAS_DIM = 2600;
// CSS px (96dpi) → PDF points (72dpi).
const PX_TO_PT = 72 / 96;

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

    setStatus({ kind: "converting", page: 0, total: 0 });

    // Render the DOCX off-screen with full styling, then snapshot each page.
    const container = document.createElement("div");
    container.className = "docx-capture-root";
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.background = "#ffffff";
    // Stop the app's oklch foreground color from being inherited.
    container.style.color = "#000000";
    document.body.appendChild(container);

    // The app's Tailwind theme sets border/outline colors in oklch on every
    // element (`*`). html2canvas 1.4.1 can't parse oklch/lab and would throw,
    // so override those leaked defaults with sRGB. Low specificity keeps
    // docx-preview's own (sRGB) colors winning.
    const resetStyle = document.createElement("style");
    resetStyle.textContent =
      ".docx-capture-root *{border-color:#e5e7eb;outline-color:#e5e7eb;text-decoration-color:currentColor;word-break:normal;overflow-wrap:normal;hyphens:none;}";
    document.head.appendChild(resetStyle);

    try {
      const { renderAsync } = await import("docx-preview");
      const html2canvas = (await import("html2canvas")).default;
      const { PDFDocument } = await import("pdf-lib");

      await renderAsync(await file.arrayBuffer(), container, undefined, {
        inWrapper: false,
        breakPages: true,
        // Honor Word's page breaks so multi-page docs actually paginate.
        ignoreLastRenderedPageBreak: false,
        ignoreWidth: false,
        ignoreHeight: false,
      });

      const sections = Array.from(
        container.querySelectorAll<HTMLElement>("section.docx"),
      );
      const pageSections = sections.length ? sections : [container];

      // Each rendered section maps to one Word page — but if a file lacks
      // page-break markers, docx-preview yields one very tall section. Slice
      // every section into page-height bands so the PDF paginates like Word.
      type Slice = {
        el: HTMLElement;
        y: number;
        sliceH: number;
        pageH: number;
        width: number;
      };
      const slices: Slice[] = [];
      for (const section of pageSections) {
        const width = section.offsetWidth;
        const minH = parseFloat(getComputedStyle(section).minHeight);
        // Fall back to A4 aspect if the page height isn't expressed.
        const pageH = minH && !Number.isNaN(minH) ? minH : width * (297 / 210);
        const totalH = section.scrollHeight;
        const count = Math.max(1, Math.ceil(totalH / pageH - 0.02));
        for (let i = 0; i < count; i++) {
          const y = i * pageH;
          slices.push({
            el: section,
            y,
            sliceH: Math.min(pageH, totalH - y),
            pageH,
            width,
          });
        }
      }
      if (slices.length === 0) throw new Error("Nothing to render.");

      const pdf = await PDFDocument.create();

      for (let i = 0; i < slices.length; i++) {
        setStatus({ kind: "converting", page: i + 1, total: slices.length });
        const { el, y, sliceH, pageH, width } = slices[i];
        const scale = Math.min(2, MAX_CANVAS_DIM / Math.max(width, pageH));

        const canvas = await html2canvas(el, {
          scale,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          x: 0,
          y,
          width,
          height: sliceH,
          windowWidth: width,
        });
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.92),
        );
        canvas.width = 0;
        canvas.height = 0;
        if (!blob) throw new Error("Could not render a page.");

        const img = await pdf.embedJpg(await blob.arrayBuffer());
        const wPt = width * PX_TO_PT;
        const pageHPt = pageH * PX_TO_PT;
        const imgHPt = sliceH * PX_TO_PT;
        const outPage = pdf.addPage([wPt, pageHPt]);
        // Anchor to the top; a short final slice leaves white space below.
        outPage.drawImage(img, {
          x: 0,
          y: pageHPt - imgHPt,
          width: wPt,
          height: imgHPt,
        });
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const outName = file.name.replace(/\.docx$/i, ".pdf");
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({ kind: "done", name: outName });
    } catch (err) {
      console.error("DOCX -> PDF conversion failed:", err);
      setStatus({
        kind: "error",
        message: "Something went wrong while converting the file.",
      });
    } finally {
      document.body.removeChild(container);
      resetStyle.remove();
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Word to PDF</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Convert a Word (.docx) file to PDF, keeping its colors, backgrounds,
        fonts, and layout.
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
            {status.total
              ? `Converting… (${status.page}/${status.total})`
              : "Converting…"}
          </>
        ) : (
          <>
            <Upload className="size-4" />
            Select Word file
          </>
        )}
      </Button>

      <p className="mt-3 text-xs text-muted-foreground">
        Pages are saved as images, so the text won’t be selectable.
      </p>

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
