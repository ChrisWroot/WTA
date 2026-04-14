const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SHEET_ID = import.meta.env.VITE_SHEET_ID;

export async function fetchSheetData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?includeGridData=true&ranges=Main&fields=sheets.data.rowData.values(userEnteredValue,userEnteredFormat.backgroundColor)&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error("Sheet fetch failed:", res.status, text);
    throw new Error("Failed to fetch");
  }
  const json = await res.json();
  return json.sheets[0].data[0].rowData.map(row => row.values || []);
}

export async function fetchOverallStats() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Overall%20Stats!A1:K24?key=${API_KEY}`;
  const res = await fetch(url);
  console.log("Overall Stats status:", res.status);
  if (!res.ok) {
    const text = await res.text();
    console.error("Overall Stats error:", text);
    throw new Error("Failed to fetch stats");
  }
  const json = await res.json();
  console.log("Overall Stats data:", json);
  const rows = json.values || [];
  return rows.slice(1).map(r => ({
    player:       r[0]  || "",
    ggWins:       parseFloat(r[1])  || 0,
    gg:           parseFloat(r[2])  || 0,
    ssWins:       parseFloat(r[3])  || 0,
    ss:           parseFloat(r[4])  || 0,
    wtaSplits:    parseFloat(r[5])  || 0,
    wtaWins:      parseFloat(r[6])  || 0,
    wtaRollovers: parseFloat(r[7])  || 0,
    wta:          parseFloat(r[8])  || 0,
    totalWins:    parseFloat(r[9])  || 0,
    total:        parseFloat(r[10]) || 0,
  })).filter(p => p.player && p.player !== "Total");
}

export async function fetchFixtures() {
  const res = await fetch("/api/fixtures");
  if (!res.ok) throw new Error("Failed to fetch fixtures");
  const json = await res.json();
  const matches = json.matches || [];
  if (!matches.length) return { gameweek: null, fixtures: [] };
  const nextMatchday = matches[0].matchday;
  return {
    gameweek: nextMatchday,
    fixtures: matches.filter(m => m.matchday === nextMatchday).map(m => ({
      home: m.homeTeam.shortName || m.homeTeam.name,
      away: m.awayTeam.shortName || m.awayTeam.name,
      date: m.utcDate,
      status: m.status,
      homeScore: m.score && m.score.fullTime ? m.score.fullTime.home : null,
      awayScore: m.score && m.score.fullTime ? m.score.fullTime.away : null,
    }))
  };
}

export async function fetchAllFixtures() {
  const res = await fetch("/api/fixtures?type=all");
  if (!res.ok) throw new Error("Failed to fetch all fixtures");
  const json = await res.json();
  const matches = json.matches || [];
  const byGW = {};
  matches.forEach(m => {
    const gw = m.matchday;
    if (!byGW[gw]) byGW[gw] = [];
    byGW[gw].push({
      home: m.homeTeam.shortName || m.homeTeam.name,
      away: m.awayTeam.shortName || m.awayTeam.name,
      date: m.utcDate,
      status: m.status,
      homeScore: m.score && m.score.fullTime ? m.score.fullTime.home : null,
      awayScore: m.score && m.score.fullTime ? m.score.fullTime.away : null,
    });
  });
  return byGW;
}
