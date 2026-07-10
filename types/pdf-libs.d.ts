// Type shims for browser/subpath entry points that don't ship their own
// declarations for these import specifiers.

declare module "mammoth/mammoth.browser" {
  export function convertToHtml(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}

declare module "html-to-pdfmake";
declare module "pdfmake/build/pdfmake";
declare module "pdfmake/build/vfs_fonts";
