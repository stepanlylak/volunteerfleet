/**
 * Multer/busboy decode the multipart `filename` header as latin1, which garbles
 * non-ASCII names (e.g. Cyrillic) read from `file.originalname`. Re-decode the
 * bytes as UTF-8 so stored object keys keep readable filenames.
 */
export function decodeUploadFileName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8');
}
