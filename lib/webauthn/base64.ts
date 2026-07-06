export function arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (typeof Buffer !== "undefined") {
    return toBase64Url(Buffer.from(bytes).toString("base64"));
  }

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return toBase64Url(btoa(binary));
}

export function base64UrlToArrayBuffer(value: string) {
  const base64 = fromBase64Url(value);

  if (typeof Buffer !== "undefined") {
    const bytes = Buffer.from(base64, "base64");

    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export function base64UrlToUint8Array(value: string) {
  return new Uint8Array(base64UrlToArrayBuffer(value));
}

function toBase64Url(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  return value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
}
