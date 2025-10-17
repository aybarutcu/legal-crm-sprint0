/**
 * Formats file size in bytes to human-readable format
 * 
 * Examples:
 * - 1024 -> "1 KB"
 * - 1536 -> "1.5 KB"
 * - 1048576 -> "1 MB"
 * - 1572864 -> "1.5 MB"
 * 
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string with appropriate unit
 */
export function formatFileSize(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 Bytes";
  if (bytes < 0) return "Invalid size";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  const value = bytes / Math.pow(k, i);
  const formattedValue = value.toFixed(decimals);
  
  return `${formattedValue} ${sizes[i]}`;
}

/**
 * Formats date to short format (e.g., "Jan 15, 2024")
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "short", 
    day: "numeric" 
  });
}

/**
 * Truncates filename while preserving extension
 * 
 * @param filename - Original filename
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated filename with extension preserved
 */
export function truncateFilename(filename: string, maxLength: number = 30): string {
  if (filename.length <= maxLength) return filename;
  
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    // No extension
    return filename.substring(0, maxLength - 3) + "...";
  }
  
  const extension = filename.substring(dotIndex);
  const nameWithoutExt = filename.substring(0, dotIndex);
  const availableLength = maxLength - extension.length - 3; // -3 for "..."
  
  if (availableLength <= 0) {
    return filename.substring(0, maxLength - 3) + "...";
  }
  
  return nameWithoutExt.substring(0, availableLength) + "..." + extension;
}
