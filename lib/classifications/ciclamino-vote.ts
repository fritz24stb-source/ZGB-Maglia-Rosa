export type CiclaminoResultChoice = {
  location: string;
  place: number | null;
  userId: string;
};

export function availableCiclaminoPlaces(
  choices: CiclaminoResultChoice[],
  location: string,
  currentUserId: string,
) {
  const occupiedByOthers = new Set(
    choices
      .filter((choice) =>
        choice.location === location
        && choice.userId !== currentUserId
        && choice.place !== null,
      )
      .map((choice) => choice.place),
  );

  return [1, 2, 3, 4, 5].filter((place) => !occupiedByOthers.has(place));
}
