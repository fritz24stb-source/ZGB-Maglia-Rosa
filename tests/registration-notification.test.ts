import { describe, expect, it } from "vitest";
import { buildRegistrationAdminNotification } from "@/lib/auth/registration-notification";

describe("registration admin notification", () => {
  it("includes the new user's display name and id", () => {
    expect(
      buildRegistrationAdminNotification({
        displayName: "Max Mustermann",
        userId: "user-1",
      }),
    ).toEqual({
      activity_id: null,
      message: "Max Mustermann hat sich neu registriert.",
      title: "Neuer User registriert",
      type: "user_registered",
      user_id: "user-1",
    });
  });
});
