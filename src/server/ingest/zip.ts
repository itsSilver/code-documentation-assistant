import path from "node:path";
import yauzl from "yauzl";
import { IngestError } from "./errors";
import { DEFAULT_LIMITS, type Limits } from "./rules";

export type RawFile = { path: string; content: Buffer };

export function safeEntryPath(name: string): string {
  const normalised = name.replace(/\\/g, "/");
  if (normalised.startsWith("/") || /^[a-zA-Z]:/.test(normalised) || normalised.includes("\0")) {
    throw new IngestError(`Unsafe path in archive: ${name}`);
  }
  if (normalised.split("/").includes("..")) {
    throw new IngestError(`Unsafe path in archive: ${name}`);
  }
  const clean = path.posix.normalize(normalised);
  if (clean.startsWith("../") || clean === "..")
    throw new IngestError(`Unsafe path in archive: ${name}`);
  return clean;
}

/**
 * Reads the files of a zip held in memory. Refuses zip-slip paths and enforces the archive,
 * entry-count and uncompressed-size limits by counting bytes actually inflated, since the sizes
 * declared in a zip header can lie. Files over `maxFileBytes` are not read at all.
 * If every file shares one top-level folder (GitHub archives do), it is stripped.
 */
export async function readZip(
  data: Buffer,
  limits: Limits = DEFAULT_LIMITS,
  onEntry?: (path: string) => void,
): Promise<RawFile[]> {
  if (data.length > limits.maxArchiveBytes) throw new IngestError("Archive is too large");
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.fromBuffer(data, { lazyEntries: true }, (err, z) =>
      err ? reject(new IngestError("Not a valid zip file")) : resolve(z),
    ),
  );

  const files: RawFile[] = [];
  let entries = 0;
  let total = 0;

  const readEntry = (entry: yauzl.Entry) =>
    new Promise<Buffer>((resolve, reject) =>
      zip.openReadStream(entry, (err, stream) => {
        if (err) return reject(new IngestError("Corrupt zip entry"));
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          total += c.length;
          if (total > limits.maxUncompressedBytes || size > limits.maxFileBytes) {
            stream.destroy();
            reject(
              new IngestError(
                total > limits.maxUncompressedBytes
                  ? "Archive expands to too much data"
                  : "skip-large",
              ),
            );
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", () => reject(new IngestError("Corrupt zip entry")));
      }),
    );

  try {
    await new Promise<void>((resolve, reject) => {
      // yauzl itself rejects names like `../x`; surface that as a user-safe error too.
      zip.on("error", (e) =>
        reject(e instanceof IngestError ? e : new IngestError(`Invalid zip: ${e.message}`)),
      );
      zip.on("end", resolve);
      const next = () => zip.readEntry();
      zip.on("entry", (entry: yauzl.Entry) => {
        void (async () => {
          try {
            if (++entries > limits.maxEntries) throw new IngestError("Archive has too many files");
            const entryPath = safeEntryPath(entry.fileName);
            if (entry.fileName.endsWith("/")) return next();
            // Declared size is only a hint, but lets us skip big files without inflating them.
            if (entry.uncompressedSize > limits.maxFileBytes) return next();
            try {
              files.push({ path: entryPath, content: await readEntry(entry) });
              onEntry?.(entryPath);
            } catch (e) {
              if (!(e instanceof IngestError && e.message === "skip-large")) throw e;
            }
            next();
          } catch (e) {
            zip.close();
            reject(e);
          }
        })();
      });
      next();
    });
  } finally {
    zip.close();
  }
  return stripCommonRoot(files);
}

function stripCommonRoot(files: RawFile[]): RawFile[] {
  if (files.length === 0) return files;
  const root = files[0].path.split("/")[0];
  if (!files.every((f) => f.path.startsWith(root + "/"))) return files;
  return files.map((f) => ({ ...f, path: f.path.slice(root.length + 1) }));
}
