export function getFormText(
  formData: FormData,
  key: string,
  message = `${key} fehlt.`,
) {
  const value = getOptionalFormText(formData, key);

  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function getOptionalFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function getFormCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export function getFormInteger(
  formData: FormData,
  key: string,
  options: {
    defaultValue?: number;
    max?: number;
    min?: number;
    message?: string;
  } = {},
) {
  const rawValue = getOptionalFormText(formData, key);

  if (!rawValue && options.defaultValue !== undefined) {
    return options.defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value)) {
    throw new Error(options.message ?? `${key} muss eine ganze Zahl sein.`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`${key} muss mindestens ${options.min} sein.`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`${key} darf maximal ${options.max} sein.`);
  }

  return value;
}

export function getOptionalFormNumber(
  formData: FormData,
  key: string,
  options: { max?: number; min?: number } = {},
) {
  const rawValue = getOptionalFormText(formData, key);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue.replace(",", "."));

  if (!Number.isFinite(value)) {
    throw new Error(`${key} muss eine Zahl sein.`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`${key} muss mindestens ${options.min} sein.`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`${key} darf maximal ${options.max} sein.`);
  }

  return value;
}

export function parseTextList(value: string | null) {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(/[,\n;]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

export function parseIntegerList(
  value: string | null,
  options: { max?: number; min?: number } = {},
) {
  const entries = parseTextList(value);

  if (entries.length === 0) {
    return null;
  }

  return entries.map((entry) => {
    const parsed = Number(entry);

    if (!Number.isInteger(parsed)) {
      throw new Error(`Ungueltige Zahl in Liste: ${entry}`);
    }

    if (options.min !== undefined && parsed < options.min) {
      throw new Error(`Listenwert muss mindestens ${options.min} sein.`);
    }

    if (options.max !== undefined && parsed > options.max) {
      throw new Error(`Listenwert darf maximal ${options.max} sein.`);
    }

    return parsed;
  });
}

export function requireTextList(value: string | null, message: string) {
  const list = parseTextList(value);

  if (list.length === 0) {
    throw new Error(message);
  }

  return list;
}
