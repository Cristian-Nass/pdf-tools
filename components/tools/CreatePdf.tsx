"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  FilePlus2,
  Italic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageKey = "A4" | "A5" | "Letter";
type FamilyKey = "sans" | "serif" | "mono";
type Align = "left" | "center" | "right";

const PAGE_SIZES: Record<PageKey, [number, number]> = {
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
};

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 24];
const LINE_SPACINGS: { label: string; value: number }[] = [
  { label: "Single", value: 1.15 },
  { label: "1.5 lines", value: 1.5 },
  { label: "Double", value: 2 },
];
const MARGIN = 56;

type BuildParams = {
  title: string;
  body: string;
  page: PageKey;
  family: FamilyKey;
  fontSize: number;
  lineSpacing: number;
  bold: boolean;
  italic: boolean;
  align: Align;
};

// Normalize typographic characters that the built-in fonts don't cover to
// plain ASCII, so pasted text from the web still renders cleanly.
const normalize = (s: string): string =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/ /g, " ")
    .replace(/\t/g, "    ");

type PdfFont = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

// Replace any character the chosen font can't encode with "?" so drawing never
// throws. Returns whether anything was swapped, to warn the user.
const encodeSafe = (font: PdfFont, text: string): { out: string; changed: boolean } => {
  let out = "";
  let changed = false;
  for (const ch of text) {
    try {
      font.widthOfTextAtSize(ch, 12);
      out += ch;
    } catch {
      out += "?";
      changed = true;
    }
  }
  return { out, changed };
};

const wrapLine = (
  text: string,
  font: PdfFont,
  size: number,
  maxWidth: number,
): string[] => {
  const words = text.split(/ +/).filter((w) => w.length > 0);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      // Hard-break a single over-long token (e.g. a pasted URL).
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
          chunk += ch;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      line = chunk;
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const buildPdf = async (
  p: BuildParams,
): Promise<{ bytes: Uint8Array; changed: boolean }> => {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");

  const families = {
    sans: {
      regular: StandardFonts.Helvetica,
      bold: StandardFonts.HelveticaBold,
      italic: StandardFonts.HelveticaOblique,
      boldItalic: StandardFonts.HelveticaBoldOblique,
    },
    serif: {
      regular: StandardFonts.TimesRoman,
      bold: StandardFonts.TimesRomanBold,
      italic: StandardFonts.TimesRomanItalic,
      boldItalic: StandardFonts.TimesRomanBoldItalic,
    },
    mono: {
      regular: StandardFonts.Courier,
      bold: StandardFonts.CourierBold,
      italic: StandardFonts.CourierOblique,
      boldItalic: StandardFonts.CourierBoldOblique,
    },
  }[p.family];

  const bodyStd = p.bold && p.italic
    ? families.boldItalic
    : p.bold
      ? families.bold
      : p.italic
        ? families.italic
        : families.regular;

  const doc = await PDFDocument.create();
  const bodyFont = await doc.embedFont(bodyStd);
  const titleFont = await doc.embedFont(families.bold);

  const [pw, ph] = PAGE_SIZES[p.page];
  const maxWidth = pw - MARGIN * 2;
  const lineHeight = p.fontSize * p.lineSpacing;
  const titleSize = Math.round(p.fontSize * 1.6);

  let changed = false;
  let page = doc.addPage([pw, ph]);
  let y = ph - MARGIN;

  const draw = (line: string, font: PdfFont, size: number) => {
    const lh = size * p.lineSpacing;
    if (y - size < MARGIN) {
      page = doc.addPage([pw, ph]);
      y = ph - MARGIN;
    }
    const width = line ? font.widthOfTextAtSize(line, size) : 0;
    let x = MARGIN;
    if (p.align === "center") x = MARGIN + (maxWidth - width) / 2;
    else if (p.align === "right") x = MARGIN + (maxWidth - width);
    if (line) {
      (page as unknown as { drawText: (t: string, o: object) => void }).drawText(
        line,
        { x, y: y - size, size, font },
      );
    }
    y -= lh;
  };

  const title = normalize(p.title).replace(/\n/g, " ").trim();
  if (title) {
    const safe = encodeSafe(titleFont, title);
    changed = changed || safe.changed;
    for (const line of wrapLine(safe.out, titleFont, titleSize, maxWidth)) {
      draw(line, titleFont, titleSize);
    }
    y -= lineHeight * 0.5;
  }

  for (const paragraph of normalize(p.body).split("\n")) {
    const safe = encodeSafe(bodyFont, paragraph);
    changed = changed || safe.changed;
    for (const line of wrapLine(safe.out, bodyFont, p.fontSize, maxWidth)) {
      draw(line, bodyFont, p.fontSize);
    }
  }

  const bytes = await doc.save();
  return { bytes, changed };
};

const selectClass =
  "h-9 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const CreatePdf: React.FC = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [page, setPage] = useState<PageKey>("A4");
  const [family, setFamily] = useState<FamilyKey>("sans");
  const [fontSize, setFontSize] = useState(12);
  const [lineSpacing, setLineSpacing] = useState(1.15);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState<Align>("left");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const urlRef = useRef<string | null>(null);

  const params: BuildParams = {
    title,
    body,
    page,
    family,
    fontSize,
    lineSpacing,
    bold,
    italic,
    align,
  };

  // Debounced live preview.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!title.trim() && !body.trim()) {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
        if (!cancelled) {
          setPreviewUrl(null);
          setChanged(false);
        }
        return;
      }
      try {
        const { bytes, changed } = await buildPdf(params);
        if (cancelled) return;
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreviewUrl(url);
        setChanged(changed);
      } catch (err) {
        console.error("Create PDF preview failed:", err);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, page, family, fontSize, lineSpacing, bold, italic, align]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const download = async () => {
    const { bytes } = await buildPdf(params);
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const base = title.trim() ? title.trim().replace(/[^\w-]+/g, "_") : "document";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasContent = title.trim() !== "" || body.trim() !== "";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FilePlus2 className="size-7" />
      </div>

      <h2 className="text-xl font-semibold">Create PDF</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Type or paste your text, pick a look, and download it as a PDF.
      </p>

      <div className="mt-6 w-full text-left">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="Page size"
            value={page}
            onChange={(e) => setPage(e.target.value as PageKey)}
            className={selectClass}
          >
            <option value="A4">A4</option>
            <option value="A5">A5</option>
            <option value="Letter">Letter</option>
          </select>
          <select
            aria-label="Font"
            value={family}
            onChange={(e) => setFamily(e.target.value as FamilyKey)}
            className={selectClass}
          >
            <option value="sans">Sans (Helvetica)</option>
            <option value="serif">Serif (Times)</option>
            <option value="mono">Mono (Courier)</option>
          </select>
          <select
            aria-label="Font size"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className={selectClass}
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} pt
              </option>
            ))}
          </select>
          <select
            aria-label="Line spacing"
            value={lineSpacing}
            onChange={(e) => setLineSpacing(Number(e.target.value))}
            className={selectClass}
          >
            {LINE_SPACINGS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Bold"
              aria-pressed={bold}
              className={cn(bold && "border-primary bg-primary/10 text-primary")}
              onClick={() => setBold((v) => !v)}
            >
              <Bold />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Italic"
              aria-pressed={italic}
              className={cn(italic && "border-primary bg-primary/10 text-primary")}
              onClick={() => setItalic((v) => !v)}
            >
              <Italic />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {([
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const).map(([value, Icon]) => (
              <Button
                key={value}
                variant="outline"
                size="icon"
                aria-label={`Align ${value}`}
                aria-pressed={align === value}
                className={cn(
                  align === value && "border-primary bg-primary/10 text-primary",
                )}
                onClick={() => setAlign(value)}
              >
                <Icon />
              </Button>
            ))}
          </div>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type or paste your text here…"
          rows={8}
          className="mt-3 w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />

        {changed && (
          <p className="mt-2 text-xs text-muted-foreground">
            Some characters aren’t supported by the built-in fonts and were
            replaced with “?”.
          </p>
        )}

        {/* Live preview */}
        <p className="mt-4 text-sm font-medium">Preview</p>
        <div className="mt-1.5 h-80 w-full overflow-hidden rounded-lg border bg-muted/40">
          {previewUrl ? (
            <iframe
              title="PDF preview"
              src={`${previewUrl}#toolbar=0`}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Start typing to see a live preview.
            </div>
          )}
        </div>
      </div>

      <Button
        className="mt-4 w-full"
        size="lg"
        onClick={download}
        disabled={!hasContent}
      >
        <Download className="size-4" />
        Download PDF
      </Button>
    </div>
  );
};

export default CreatePdf;
