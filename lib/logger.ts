import { redactSensitiveValue } from "@/lib/security/redaction";

type LogLevel = "error" | "info" | "warn";

export function logInfo(event: string, details?: unknown) {
  writeLog("info", event, details);
}

export function logWarn(event: string, details?: unknown) {
  writeLog("warn", event, details);
}

export function logError(event: string, error: unknown, details?: unknown) {
  writeLog("error", event, {
    ...(details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : { details }),
    error: serializeError(error),
  });
}

export function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return redactSensitiveValue(error, { maxDepth: 4, maxStringLength: 1000 });
  }

  const serialized: Record<string, unknown> = {
    message: error.message,
    name: error.name,
  };
  const maybeStatus = (error as { status?: unknown }).status;

  if (typeof maybeStatus === "number") {
    serialized.status = maybeStatus;
  }

  if (process.env.NODE_ENV !== "production" && error.stack) {
    serialized.stack = error.stack;
  }

  return redactSensitiveValue(serialized, {
    maxDepth: 4,
    maxStringLength: 2000,
  });
}

function writeLog(level: LogLevel, event: string, details?: unknown) {
  const entry = {
    event,
    level,
    timestamp: new Date().toISOString(),
    ...(details === undefined
      ? {}
      : {
          details: redactSensitiveValue(details, {
            maxDepth: 6,
            maxStringLength: 2000,
          }),
        }),
  };
  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}
