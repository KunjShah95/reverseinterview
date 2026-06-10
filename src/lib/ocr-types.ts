export type OcrSummary = {
  method: string;
  confidence: number;
  warnings: string[];
  pagesProcessed?: number;
  pagesWithText?: number;
  averageWordCount?: number;
};
