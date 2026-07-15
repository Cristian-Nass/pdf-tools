"use client";

import { useState } from "react";
import {
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Layers,
  Minimize2,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CreatePdf from "@/components/tools/CreatePdf";
import DocxToPdf from "@/components/tools/DocxToPdf";
import MergePdf from "@/components/tools/MergePdf";
import ImagesToPdf from "@/components/tools/ImagesToPdf";
import SplitPdf from "@/components/tools/SplitPdf";
import CompressPdf from "@/components/tools/CompressPdf";

type Tool = "create" | "docx" | "images" | "merge" | "split" | "compress";

const tabs: { id: Tool; label: string; icon: React.ElementType }[] = [
  { id: "create", label: "Create PDF", icon: FilePlus2 },
  { id: "docx", label: "Word to PDF", icon: FileText },
  { id: "images", label: "Images to PDF", icon: ImageIcon },
  { id: "merge", label: "Merge PDFs", icon: Layers },
  { id: "split", label: "Split PDF", icon: Scissors },
  { id: "compress", label: "Compress PDF", icon: Minimize2 },
];

const PdfTools: React.FC = () => {
  const [tool, setTool] = useState<Tool>("create");

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">PDF Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, convert, combine, split, and compress PDFs — right in your
          browser.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="PDF tools"
        className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-6"
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
        {tool === "create" && <CreatePdf />}
        {tool === "docx" && <DocxToPdf />}
        {tool === "merge" && <MergePdf />}
        {tool === "split" && <SplitPdf />}
        {tool === "compress" && <CompressPdf />}
        {tool === "images" && <ImagesToPdf />}
      </div>
    </div>
  );
};

export default PdfTools;
