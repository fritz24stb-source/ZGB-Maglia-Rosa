import React, { type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainNav } from "@/components/main-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/leaderboard",
}));

vi.mock("next/image", () => ({
  default: ({
    priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    void priority;
    return React.createElement("img", props);
  },
}));

describe("MainNav", () => {
  it("uses the PWA icon in the header brand", () => {
    render(React.createElement(MainNav));

    expect(document.querySelector('img[src="/pwa-icon.svg"]')).not.toBeNull();
  });

  it("toggles the mobile navigation from the menu button", () => {
    render(React.createElement(MainNav));

    const button = screen.getByRole("button", {
      name: "Navigation öffnen",
    });
    const mobileNavigation = document.getElementById("mobile-navigation");

    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(mobileNavigation?.className).toContain("hidden");

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Navigation schließen" })).toBe(
      button,
    );
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(mobileNavigation?.className).toContain("block");
    expect(mobileNavigation?.textContent).toContain("Manuell");
  });
});
