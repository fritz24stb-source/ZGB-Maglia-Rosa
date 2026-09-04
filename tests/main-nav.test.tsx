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
    render(
      React.createElement(MainNav, {
        classificationsEnabled: false,
        role: null,
      }),
    );

    expect(document.querySelector('img[src="/pwa-icon.svg"]')).not.toBeNull();
    expect(screen.getByText("ZGB-Maglia-Rosa")).not.toBeNull();
    expect(screen.queryByText(["Strava", "Wertung"].join("-"))).toBeNull();
  });

  it("toggles the mobile navigation from the menu button", () => {
    render(
      React.createElement(MainNav, {
        classificationsEnabled: false,
        role: "member",
      }),
    );

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
    expect(mobileNavigation?.textContent).not.toContain("Sprintleitung");
  });

  it("shows classification management only to enabled staff", () => {
    const { rerender } = render(
      React.createElement(MainNav, {
        classificationsEnabled: true,
        role: "scorekeeper",
      }),
    );

    expect(screen.getAllByText("Sprintleitung")).toHaveLength(2);

    rerender(
      React.createElement(MainNav, {
        classificationsEnabled: false,
        role: "scorekeeper",
      }),
    );

    expect(screen.queryByText("Sprintleitung")).toBeNull();
  });
});
