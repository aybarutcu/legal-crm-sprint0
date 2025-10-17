import { FileText, Image, FileSpreadsheet, File, FileCheck } from "lucide-react";

type DocumentTypeIconProps = {
  mimeType: string;
  className?: string;
};

/**
 * Displays an appropriate icon based on document MIME type
 * 
 * Supported types:
 * - PDF: FileText icon (red)
 * - Images: Image icon (purple)
 * - Excel/Spreadsheets: FileSpreadsheet icon (green)
 * - Word: FileCheck icon (blue)
 * - Generic: File icon (slate)
 */
export function DocumentTypeIcon({ mimeType, className = "h-5 w-5" }: DocumentTypeIconProps) {
  const mime = mimeType.toLowerCase();
  
  // Images
  if (mime.startsWith("image/")) {
    return <Image className={`${className} text-purple-500`} />;
  }
  
  // PDF
  if (mime === "application/pdf") {
    return <FileText className={`${className} text-red-500`} />;
  }
  
  // Excel/Spreadsheets
  if (
    mime.includes("spreadsheet") ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return <FileSpreadsheet className={`${className} text-green-600`} />;
  }
  
  // Word documents
  if (
    mime.includes("wordprocessing") ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <FileCheck className={`${className} text-blue-600`} />;
  }
  
  // Generic file
  return <File className={`${className} text-slate-400`} />;
}
