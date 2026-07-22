export function buildRegistrationAdminNotification(input: {
  displayName: string;
  userId: string;
}) {
  return {
    activity_id: null,
    message: `${input.displayName} hat sich neu registriert.`,
    title: "Neuer User registriert",
    type: "user_registered",
    user_id: input.userId,
  };
}
