import { RANDOM_QUOTE_COMMAND } from "./commands";

export async function registerGlobalCommands(
  applicationId: string,
  token: string
) {
  if (!token) {
    throw new Error("The DISCORD_TOKEN environment variable is required.");
  }
  if (!applicationId) {
    throw new Error(
      "The DISCORD_APPLICATION_ID environment variable is required."
    );
  }

  const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;
  await registerCommands(url, token);
}

export async function registerCommands(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${token}`,
    },
    method: "PUT",
    body: JSON.stringify([RANDOM_QUOTE_COMMAND]),
  });

  if (!response.ok) {
    throw new Error("Error registering commands");
  }
}
