type ExistingStravaConnection = {
  revoked: boolean;
  user_id: string;
};

export function shouldRunAutomaticUserResync(
  existingConnection: ExistingStravaConnection | null,
) {
  return existingConnection === null;
}
