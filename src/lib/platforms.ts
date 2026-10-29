// Compartido entre cliente y servidor. Debe coincidir con el CHECK de boards.platform.
export const PLATFORMS = {
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "Kick",
  tiktok: "TikTok",
  other: "another platform",
} as const;

export type Platform = keyof typeof PLATFORMS;
export const PLATFORM_KEYS = Object.keys(PLATFORMS) as Platform[];

export const platformLabel = (p: Platform) => (p === "other" ? "Other" : PLATFORMS[p]);

/** "tokyo's Twitch streams" · "tokyo's streams" · "the stream" */
export function streamPhrase(streamer: string, platform: Platform): string {
  const name = streamer.trim();
  if (!name) return "the stream";
  const owner = /s$/i.test(name) ? `${name}'` : `${name}'s`;
  return platform === "other" ? `${owner} streams` : `${owner} ${PLATFORMS[platform]} streams`;
}
