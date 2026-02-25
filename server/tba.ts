const TBA_BASE = "https://www.thebluealliance.com/api/v3";

function getApiKey(): string {
  const key = process.env.TBA_API_KEY;
  if (!key) throw new Error("TBA_API_KEY not set");
  return key;
}

async function tbaFetch(path: string) {
  const res = await fetch(`${TBA_BASE}${path}`, {
    headers: { "X-TBA-Auth-Key": getApiKey() },
  });
  if (!res.ok) {
    throw new Error(`TBA API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export interface TBAMatchVideo {
  matchKey: string;
  matchNumber: number;
  compLevel: string;
  videos: { type: string; key: string }[];
}

export async function fetchMatchVideos(eventKey: string): Promise<TBAMatchVideo[]> {
  const matches: any[] = await tbaFetch(`/event/${eventKey}/matches`);

  return matches.map(m => ({
    matchKey: m.key,
    matchNumber: m.match_number,
    compLevel: m.comp_level,
    videos: m.videos || [],
  }));
}

export function getVideoUrl(videos: { type: string; key: string }[]): string | null {
  const yt = videos.find(v => v.type === "youtube");
  if (yt) return `https://www.youtube.com/watch?v=${yt.key}`;
  const tw = videos.find(v => v.type === "twitchvod");
  if (tw) return `https://www.twitch.tv/videos/${tw.key}`;
  return null;
}

export async function validateEventKey(eventKey: string): Promise<{ valid: boolean; name?: string }> {
  try {
    const event: any = await tbaFetch(`/event/${eventKey}/simple`);
    return { valid: true, name: event.name };
  } catch {
    return { valid: false };
  }
}
