import React, { type ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassificationLeaderboard } from "@/components/classification-leaderboards";
import type { ClassificationLeaderboardResponse } from "@/lib/classifications/types";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", props),
}));

describe("ClassificationLeaderboard", () => {
  it("marks the Ciclamino leader with the Ciclamino jersey", () => {
    render(
      <ClassificationLeaderboard
        active="ciclamino"
        data={classificationResponse()}
      />,
    );

    const leaderJerseys = screen.getAllByRole("img", {
      name: "Maglia Ciclamino",
    });

    expect(leaderJerseys).toHaveLength(2);
    expect(leaderJerseys.every((jersey) => jersey.getAttribute("src") === "/maglia-ciclamino.png")).toBe(true);
  });
});

function classificationResponse(): ClassificationLeaderboardResponse {
  return {
    seasons: [
      {
        id: "season-1",
        name: "Saison 2026",
        isActive: true,
        startsOn: "2026-04-01",
        endsOn: "2026-10-31",
      },
    ],
    selectedSeasonId: "season-1",
    ciclamino: [
      {
        place: 1,
        userId: "leader",
        displayName: "Leader",
        seasonId: "season-1",
        seasonName: "Saison 2026",
        totalPoints: 25,
        wins: 3,
        secondPlaces: 1,
        thirdPlaces: 0,
        fourthPlaces: 0,
        fifthPlaces: 0,
        combativeAwards: 1,
        sprintCount: 4,
      },
    ],
    ciclaminoSprintDays: [],
    azzurra: [],
  };
}
