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

export interface TBAMatchResult {
  matchNumber: number;
  compLevel: string;
  redScore: number | null;
  blueScore: number | null;
  winningAlliance: string | null;
  videos: { type: string; key: string }[];
}

export async function fetchMatchResults(eventKey: string): Promise<TBAMatchResult[]> {
  const matches: any[] = await tbaFetch(`/event/${eventKey}/matches`);

  return matches
    .filter(m => m.comp_level === "qm")
    .map(m => ({
      matchNumber: m.match_number,
      compLevel: m.comp_level,
      redScore: m.alliances?.red?.score ?? null,
      blueScore: m.alliances?.blue?.score ?? null,
      winningAlliance: m.winning_alliance || null,
      videos: m.videos || [],
    }));
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

export async function fetchTeamAvatar(teamNumber: number, year: number = 2025): Promise<string | null> {
  try {
    const media: any[] = await tbaFetch(`/team/frc${teamNumber}/media/${year}`);
    const avatar = media.find((m: any) => m.type === "avatar");
    if (avatar?.details?.base64Image) {
      return `data:image/png;base64,${avatar.details.base64Image}`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchTeamAvatars(teamNumbers: number[], year: number = 2025): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  const batchSize = 5;
  for (let i = 0; i < teamNumbers.length; i += batchSize) {
    const batch = teamNumbers.slice(i, i + batchSize);
    const promises = batch.map(async (num) => {
      const avatar = await fetchTeamAvatar(num, year);
      if (avatar) results.set(num, avatar);
    });
    await Promise.all(promises);
  }
  return results;
}

export interface TBAOprData {
  teamNumber: number;
  opr: number;
  dpr: number;
  ccwm: number;
}

export async function fetchEventOPRs(eventKey: string): Promise<TBAOprData[]> {
  const data: any = await tbaFetch(`/event/${eventKey}/oprs`);
  if (!data?.oprs) return [];

  const results: TBAOprData[] = [];
  for (const [teamKey, opr] of Object.entries(data.oprs)) {
    const teamNumber = parseInt(teamKey.replace("frc", ""));
    if (isNaN(teamNumber)) continue;
    results.push({
      teamNumber,
      opr: opr as number,
      dpr: (data.dprs?.[teamKey] as number) || 0,
      ccwm: (data.ccwms?.[teamKey] as number) || 0,
    });
  }
  return results;
}

export interface TBAScheduleMatch {
  matchNumber: number;
  red1: number | null;
  red2: number | null;
  red3: number | null;
  blue1: number | null;
  blue2: number | null;
  blue3: number | null;
  time: string | null;
}

function parseTeamNum(key: string | undefined): number | null {
  if (!key) return null;
  const num = parseInt(key.replace("frc", ""));
  return isNaN(num) ? null : num;
}

export async function fetchMatchSchedule(eventKey: string): Promise<TBAScheduleMatch[]> {
  const matches: any[] = await tbaFetch(`/event/${eventKey}/matches`);

  return matches
    .filter(m => m.comp_level === "qm")
    .map(m => {
      const redTeams = m.alliances?.red?.team_keys || [];
      const blueTeams = m.alliances?.blue?.team_keys || [];
      let timeStr: string | null = null;
      if (m.time) {
        const d = new Date(m.time * 1000);
        timeStr = d.toISOString().replace("T", " ").slice(0, 16);
      }
      return {
        matchNumber: m.match_number,
        red1: parseTeamNum(redTeams[0]),
        red2: parseTeamNum(redTeams[1]),
        red3: parseTeamNum(redTeams[2]),
        blue1: parseTeamNum(blueTeams[0]),
        blue2: parseTeamNum(blueTeams[1]),
        blue3: parseTeamNum(blueTeams[2]),
        time: timeStr,
      };
    })
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

export async function validateEventKey(eventKey: string): Promise<{ valid: boolean; name?: string }> {
  try {
    const event: any = await tbaFetch(`/event/${eventKey}/simple`);
    return { valid: true, name: event.name };
  } catch {
    return { valid: false };
  }
}
