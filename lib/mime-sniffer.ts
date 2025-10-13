import { Buffer } from "node:buffer";

const PDF_SIGNATURE = Buffer.from("%PDF-");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const GIF_SIGNATURE = Buffer.from("GIF8");
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

function bufferStartsWith(buffer: Buffer, signature: Buffer, offset = 0) {
  if (buffer.length < signature.length + offset) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (buffer[index + offset] !== signature[index]) {
      return false;
    }
  }
  return true;
}

function isLikelyText(buffer: Buffer) {
  if (!buffer.length) return false;
  const sampleLength = Math.min(buffer.length, 512);
  let printable = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index];
    if (byte === 0x00) return false;
    if (
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      (byte >= 0x20 && byte <= 0x7e)
    ) {
      printable += 1;
    }
  }
  return printable / sampleLength > 0.8;
}

export function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (bufferStartsWith(buffer, PDF_SIGNATURE)) {
    return "application/pdf";
  }

  if (bufferStartsWith(buffer, PNG_SIGNATURE)) {
    return "image/png";
  }

  if (bufferStartsWith(buffer, JPEG_SIGNATURE)) {
    return "image/jpeg";
  }

  if (bufferStartsWith(buffer, GIF_SIGNATURE)) {
    return "image/gif";
  }

  if (
    bufferStartsWith(buffer, WEBP_RIFF) &&
    bufferStartsWith(buffer, WEBP_WEBP, 8)
  ) {
    return "image/webp";
  }

  if (bufferStartsWith(buffer, OLE_SIGNATURE)) {
    return "application/msword";
  }

  if (bufferStartsWith(buffer, ZIP_SIGNATURE)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (isLikelyText(buffer)) {
    const asText = buffer.toString("utf8");
    const trimmed = asText.trimStart().toLowerCase();
    if (trimmed.startsWith("<svg")) {
      return "image/svg+xml";
    }
    return "text/plain";
  }

  return null;
}

export function isMimeCompatible(expected: string, detected: string | null) {
  if (!detected) return false;
  const expectedLower = expected.toLowerCase();
  const detectedLower = detected.toLowerCase();

  if (expectedLower === detectedLower) {
    return true;
  }

  if (
    expectedLower.startsWith("image/") &&
    detectedLower.startsWith("image/")
  ) {
    return true;
  }

  if (
    expectedLower === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    detectedLower === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return true;
  }

  if (expectedLower === "text/plain" && detectedLower === "text/plain") {
    return true;
  }

  return false;
}
