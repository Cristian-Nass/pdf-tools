import PdfTools from "@/components/PdfTools";

export default function Home() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black">
      <main className="w-full">
        <PdfTools />
      </main>
    </div>
  );
}
