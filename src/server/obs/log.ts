export type LogFields = Record<string, unknown>;

const SECRET_KEY = /api[-_]?key|secret|authorization|password|bearer|cookie|^token$/i;
/** Fields that hold file or prompt text; only their length is logged. */
const CONTENT_KEY = /^(content|text|prompt|answer|question|system|messages|body)$/i;
const MAX_STRING = 200;

export function redact(value: unknown, key = "", depth = 0): unknown {
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (CONTENT_KEY.test(key)) return `[${value.length} chars]`;
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[${value.length} chars]`
      : value;
  }
  if (CONTENT_KEY.test(key) && value && typeof value === "object") return "[omitted]";
  if (Array.isArray(value))
    return depth > 4 ? "[deep]" : value.map((v) => redact(v, key, depth + 1));
  if (value instanceof Error) return value.message.slice(0, MAX_STRING);
  if (value && typeof value === "object") {
    if (depth > 4) return "[deep]";
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k, depth + 1)]));
  }
  return value;
}

export type Level = "debug" | "info" | "warn" | "error";

export function log(level: Level, msg: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...(redact(fields) as object),
  });
  (level === "error" ? console.error : console.log)(line);
}
