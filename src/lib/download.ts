/** Saves `text` as a file through the browser's download mechanism. */
export function downloadText(text: string, fileName: string, type = 'application/json'): void {
  download(new Blob([text], { type }), fileName);
}

/** Saves `bytes` as a file, as `downloadText` saves text. */
export function downloadBytes(
  bytes: Uint8Array<ArrayBuffer>,
  fileName: string,
  type: string,
): void {
  download(new Blob([bytes], { type }), fileName);
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers read the blob after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
