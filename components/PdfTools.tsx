"use client";

import { useState } from "react";
import { FileText, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import DocxToPdf from "@/components/tools/DocxToPdf";
import MergePdf from "@/components/tools/MergePdf";

type Tool = "docx" | "merge";

const tabs: { id: Tool; label: string; icon: React.ElementType }[] = [
  { id: "docx", label: "Word to PDF", icon: FileText },
  { id: "merge", label: "Merge PDFs", icon: Layers },
];

const PdfTools: React.FC = () => {
  const [tool, setTool] = useState<Tool>("docx");

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">PDF Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Convert Word documents and combine PDFs — right in your browser.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="PDF tools"
        className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tool === id}
            onClick={() => setTool(id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
        {tool === "docx" ? <DocxToPdf /> : <MergePdf />}
      </div>
    </div>
  );
};

export default PdfTools;
