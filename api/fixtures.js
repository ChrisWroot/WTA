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
      homeScore: m.score?.fullTime?.home,
      awayScore: m.score?.fullTime?.away,
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
      homeScore: m.score?.fullTime?.home,
      awayScore: m.score?.fullTime?.away,
    });
  });
  return byGW;
}
