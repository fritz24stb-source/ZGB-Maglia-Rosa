export const REDACTED_VALUE = "[redacted]";

const SENSITIVE_FIELD_PATTERN =
  /(access[_-]?token|refresh[_-]?token|client[_-]?secret|service[_-]?role|authorization|cookie|password|secret|token)/i;

type RedactionOptions = {
  maxDepth?: number;
  maxStringLength?: number;
};

export function isSensitiveFieldName(fieldName: string) {
  return SENSITIVE_FIELD_PATTERN.test(fieldName);
}

export function redactSensitiveValue(
  value: unknown,
  options: RedactionOptions = {},
): unknown {
  return redact(value, {
    maxDepth: options.maxDepth ?? 8,
    maxStringLength: options.maxStringLength ?? 2000,
  });
}

function redact(
  value: unknown,
  options: Required<RedactionOptions>,
  depth = 0,
): unknown {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value, options.maxStringLength);
  }

  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= options.maxDepth) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, options, depth + 1));
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const redactedObject: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveFieldName(key)) {
      redactedObject[key] = REDACTED_VALUE;
      continue;
    }

    const redactedValue = redact(nestedValue, options, depth + 1);

    if (redactedValue !== undefined) {
      redactedObject[key] = redactedValue;
    }
  }

  return redactedObject;
}

function truncateString(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...[truncated]`;
}
