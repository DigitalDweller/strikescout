const TBA_BASE = "https://www.thebluealliance.com/api/v3";

/** Whether TBA_API_KEY is set (so TBA features can be used). */
export function isTbaConfigured(): boolean {
  return !!process.env.TBA_API_KEY?.trim();
}

function getApiKey(): string {
  const key = process.env.TBA_API_KEY?.trim();
  if (!key) throw new Error("TBA API key not configured. Add TBA_API_KEY to your .env file.");
  return key;
}

async function tbaFetch(path: string): Promise<any> {
  const res = await fetch(`${TBA_BASE}${path}`, {
    headers: { "X-TBA-Auth-Key": getApiKey() },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `TBA API error ${res.status}`;
    try {
      const json = JSON.parse(text);
      if (json.Error) message += `: ${json.Error}`;
      else if (json.message) message += `: ${json.message}`;
      else if (text) message += `: ${text.slice(0, 200)}`;
    } catch {
      if (text) message += `: ${text.slice(0, 200)}`;
    }
    throw new Error(message);
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

export async function fetchTeamAvatar(teamNumber: number, year: number = 2026): Promise<string | null> {
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

export async function fetchTeamAvatars(teamNumbers: number[], year: number = 2026): Promise<Map<number, string>> {
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

export interface TBAEventTeam {
  teamNumber: number;
  teamName: string;
  city: string | null;
  stateProv: string | null;
  country: string | null;
}

export async function fetchEventTeams(eventKey: string): Promise<TBAEventTeam[]> {
  const raw: any[] = await tbaFetch(`/event/${eventKey}/teams`);
  return raw
    .filter((t: any) => t && (t.key || t.team_number != null))
    .map((t: any) => {
      const key = t.key ?? t.team_key ?? "";
      const teamNumber = parseInt(String(key).replace(/^frc/i, ""), 10) || Number(t.team_number) || 0;
      const teamName = t.nickname ?? t.name ?? `Team ${teamNumber}`;
      return {
        teamNumber: isNaN(teamNumber) ? 0 : teamNumber,
        teamName: String(teamName || "").trim() || `Team ${teamNumber}`,
        city: t.city ? String(t.city) : null,
        stateProv: t.state_prov ?? t.stateProv ? String(t.state_prov ?? t.stateProv) : null,
        country: t.country ? String(t.country) : null,
      };
    })
    .filter((t: TBAEventTeam) => t.teamNumber > 0);
}

export interface TBAOprData {
  teamNumber: number;
  opr: number;
  dpr: number;
  ccwm: number;
}

export async function fetchEventOPRs(eventKey: string): Promise<TBAOprData[]> {
  const data: any = await tbaFetch(`/event/${eventKey}/oprs`);
  const oprs = data?.oprs && typeof data.oprs === "object" ? data.oprs : {};
  const dprs = data?.dprs && typeof data.dprs === "object" ? data.dprs : {};
  const ccwms = data?.ccwms && typeof data.ccwms === "object" ? data.ccwms : {};

  const results: TBAOprData[] = [];
  for (const [teamKey, opr] of Object.entries(oprs)) {
    const teamNumber = parseInt(String(teamKey).replace(/^frc/i, ""), 10);
    if (isNaN(teamNumber)) continue;
    results.push({
      teamNumber,
      opr: Number(opr) || 0,
      dpr: Number(dprs[teamKey]) || 0,
      ccwm: Number(ccwms[teamKey]) || 0,
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
  const num = parseInt(key.replace(/^frc/i, ""), 10);
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

export interface TBARankingData {
  teamNumber: number;
  rank: number;
  rankingPoints: number;
  wins: number;
  losses: number;
  ties: number;
}

export async function fetchEventRankings(eventKey: string): Promise<TBARankingData[]> {
  const data: any = await tbaFetch(`/event/${eventKey}/rankings`);
  const raw = data?.rankings;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  return list
    .filter((r: any) => r && (r.team_key || r.teamKey))
    .map((r: any) => {
      const teamKey = r.team_key ?? r.teamKey ?? "";
      const teamNumber = parseInt(String(teamKey).replace(/^frc/i, ""), 10);
      const record = r.record ?? {};
      const sortOrders = r.sort_orders ?? r.sortOrders ?? [];
      return {
        teamNumber: isNaN(teamNumber) ? 0 : teamNumber,
        rank: Number(r.rank) ?? 0,
        rankingPoints: Number(sortOrders[0]) ?? 0,
        wins: Number(record.wins) ?? 0,
        losses: Number(record.losses) ?? 0,
        ties: Number(record.ties) ?? 0,
      };
    })
    .filter((r: TBARankingData) => r.teamNumber > 0);
}

export async function validateEventKey(eventKey: string): Promise<{ valid: boolean; name?: string }> {
  try {
    const event: any = await tbaFetch(`/event/${eventKey}/simple`);
    return { valid: true, name: event.name };
  } catch {
    return { valid: false };
  }
}
