import React, { type ImgHTMLAttributes } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaderboardPreview } from "@/components/leaderboard-preview";
import type { LeaderboardResponse } from "@/lib/leaderboard/types";

vi.mock("next/image", () => ({
  default: ({
    priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    void priority;
    return React.createElement("img", props);
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LeaderboardPreview", () => {
  it("renders initial rows without a client fetch", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(<LeaderboardPreview initialData={leaderboardResponse()} />);

    expect(screen.getAllByText("Anna")).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the current rows visible while filters are refreshed", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LeaderboardPreview initialData={leaderboardResponse()} />);

    fireEvent.change(screen.getAllByLabelText("Quelle")[0], {
      target: { value: "manual" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Filter anwenden" })[0],
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("Anna")).toHaveLength(2);
    expect(screen.getByText("Rangliste wird aktualisiert.")).not.toBeNull();

    await act(async () => {
      resolveFetch?.(
        jsonResponse(
          leaderboardResponse({
            displayName: "Bernd",
            userId: "user-bernd",
          }),
        ),
      );
    });

    await waitFor(() => expect(screen.getAllByText("Bernd")).toHaveLength(2));
  });

  it("keeps the current rows visible when a refresh fails", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: "Aktualisierung fehlgeschlagen." }, 500),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LeaderboardPreview initialData={leaderboardResponse()} />);

    fireEvent.change(screen.getAllByLabelText("Quelle")[0], {
      target: { value: "manual" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Filter anwenden" })[0],
    );

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toContain("Aktualisierung fehlgeschlagen.");
    expect(screen.getAllByText("Anna")).toHaveLength(2);
  });
});

function leaderboardResponse(
  rowOverrides: Partial<LeaderboardResponse["rows"][number]> = {},
): LeaderboardResponse {
  return {
    rows: [
      {
        place: 1,
        userId: "user-anna",
        displayName: "Anna",
        seasonId: "00000000-0000-4000-8000-000000002026",
        seasonName: "Saison 2026",
        totalPoints: 300,
        totalRides: 3,
        samstagsFahrten: 2,
        mittwochsFahrten: 1,
        sonderevents: 0,
        manualPoints: 0,
        ...rowOverrides,
      },
    ],
    filters: {
      seasonId: "00000000-0000-4000-8000-000000002026",
      category: null,
      source: null,
      from: null,
      to: null,
      memberId: null,
      sportType: null,
    },
    sort: {
      key: "totalPoints",
      direction: "desc",
    },
    options: {
      seasons: [
        {
          value: "00000000-0000-4000-8000-000000002026",
          label: "Saison 2026",
          isActive: true,
          startsOn: "2026-01-01",
          endsOn: "2026-12-31",
        },
      ],
      categories: [],
      sources: [
        { value: "strava", label: "Strava" },
        { value: "manual", label: "Manuell" },
      ],
    },
    generatedAt: "2026-07-23T10:00:00.000Z",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
