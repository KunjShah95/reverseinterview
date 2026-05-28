export type OcrMethod = "text-extract" | "tesseract";

export type OcrSummary = {
  method: OcrMethod;
  confidence: number;
  warnings: string[];
  pagesProcessed?: number;
  pagesWithText?: number;
  averageWordCount?: number;
};
