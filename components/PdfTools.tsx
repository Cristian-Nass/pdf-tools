"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, Layers, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import DocxToPdf from "@/components/tools/DocxToPdf";
import MergePdf from "@/components/tools/MergePdf";
import ImagesToPdf from "@/components/tools/ImagesToPdf";
import SplitPdf from "@/components/tools/SplitPdf";

type Tool = "docx" | "merge" | "images" | "split";

const tabs: { id: Tool; label: string; icon: React.ElementType }[] = [
  { id: "docx", label: "Word to PDF", icon: FileText },
  { id: "merge", label: "Merge PDFs", icon: Layers },
  { id: "split", label: "Split PDF", icon: Scissors },
  { id: "images", label: "Images to PDF", icon: ImageIcon },
];

const PdfTools: React.FC = () => {
  const [tool, setTool] = useState<Tool>("docx");

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">PDF Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Convert, combine, split, and build PDFs — right in your browser.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="PDF tools"
        className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tool === id}
            onClick={() => setTool(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-2.5 text-center text-xs font-medium leading-tight transition-colors",
              tool === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        {tool === "docx" && <DocxToPdf />}
        {tool === "merge" && <MergePdf />}
        {tool === "split" && <SplitPdf />}
        {tool === "images" && <ImagesToPdf />}
      </div>
    </div>
  );
};

export default PdfTools;
