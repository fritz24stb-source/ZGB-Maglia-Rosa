import { describe, expect, it } from "vitest";
import {
  arrayBufferToBase64Url,
  base64UrlToUint8Array,
} from "@/lib/webauthn/base64";

describe("webauthn base64url helpers", () => {
  it("encodes bytes without relying on the base64url Buffer encoding", () => {
    const bytes = new Uint8Array([0, 255, 254, 128]);

    expect(arrayBufferToBase64Url(bytes)).toBe("AP_-gA");
  });

  it("decodes base64url values back to bytes", () => {
    expect([...base64UrlToUint8Array("AP_-gA")]).toEqual([0, 255, 254, 128]);
  });
});
