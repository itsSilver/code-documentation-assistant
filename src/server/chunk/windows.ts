export type Window = { start: number; end: number };

/**
 * Splits the 0-based inclusive line range [start, end] into windows of at most `maxChars`
 * characters (a single longer line still gets its own window). Each window after the first
 * starts up to `overlap` lines (never more than half the previous window) before the previous one ended, so a statement cut at a boundary
 * appears whole in at least one window.
 */
export function lineWindows(
  lines: string[],
  start: number,
  end: number,
  maxChars: number,
  overlap: number,
): Window[] {
  const windows: Window[] = [];
  let from = start;
  while (from <= end) {
    let to = from;
    let size = lines[from].length + 1;
    while (to < end && size + lines[to + 1].length + 1 <= maxChars) {
      to++;
      size += lines[to].length + 1;
    }
    windows.push({ start: from, end: to });
    if (to >= end) break;
    // Overlap at most half the window, so long-line text still advances by half a window or more.
    const count = to - from + 1;
    from = to + 1 - Math.min(overlap, Math.floor(count / 2));
  }
  return windows;
}
