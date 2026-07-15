const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

export function pastedFilename(mime: string, now: Date = new Date()): string {
  const ext = MIME_TO_EXT[mime] ?? "bin";
  // ISO 8601 with colons replaced — safe across Windows / POSIX filenames.
  const stamp = now.toISOString().replace(/:/g, "-");
  return `pasted-${stamp}.${ext}`;
}
