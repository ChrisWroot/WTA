import { useState, useMemo, useEffect } from "react";
import { fetchSheetData, fetchOverallStats, fetchFixtures, fetchAllFixtures } from "./data.js";
import { STATIC_DATA, PRIZE_OUTCOMES, PLAYERS, TEAM_COLORS } from "./constants.js";
const ABBR_FULL = {
  ARS:"Arsenal",MCI:"Man City",LIV:"Liverpool",TOT:"Spurs",CHE:"Chelsea",
  MUN:"Man Utd",NEW:"Newcastle",AVL:"Aston Villa",BHA:"Brighton",BOU:"Bournemouth",
  WOL:"Wolves",NFO:"Nottm Forest",BRE:"Brentford",CRY:"Crystal Palace",
  EVE:"Everton",FUL:"Fulham",WHU:"West Ham",IPS:"Ipswich",SUN:"Sunderland",
};
function getCellColor(rowData, colIdx) {
  try {
    const bg = rowData[colIdx]?.userEnteredFormat?.backgroundColor;
    if (!bg) return null;
    const { red = 0, green = 0, blue = 0 } = bg;
    if (green > 0.5 && red < 0.6 && blue < 0.5) return "green";
    if (red > 0.6 && green < 0.5 && blue < 0.5) return "red";
    return null;
  } catch { return null; }
}

function parseSheetData(formattedRows) {
  const headerRow = formattedRows[0] || [];
  const roundRow = formattedRows[1] || [];
  const result = {};

  const gameMap = {};
  headerRow.forEach((cell, colIdx) => {
    const val = (cell?.userEnteredValue?.stringValue || "").trim();
    const match = val.match(/(\d{4})\s+Round\s+(\d+)/i);
    if (match) {
      const season = match[1];
      const gameKey = `Game ${match[2]}`;
      const mapKey = `${season}|${gameKey}`;
      if (!gameMap[mapKey]) {
        gameMap[mapKey] = { season, gameKey, start: colIdx, end: colIdx };
      } else {
        gameMap[mapKey].end = colIdx;
      }
    }
  });

  const entries = Object.values(gameMap).sort((a, b) => a.start - b.start);
  entries.forEach((entry, i) => {
    if (i + 1 < entries.length) {
      entry.end = entries[i + 1].start - 1;
    } else {
      entry.end = headerRow.length - 1;
    }
  });

  entries.forEach(({ season, gameKey, start, end }) => {
    if (!result[season]) result[season] = {};
    const rounds = [];
    for (let c = start; c <= end; c++) {
      const val = roundRow[c]?.userEnteredValue?.numberValue;
      if (val !== undefined) rounds.push(Math.round(val));
    }
    const picks = {};
    for (let r = 2; r <= 21; r++) {
      const playerRow = formattedRows[r];
      if (!playerRow) continue;
      const playerCell = playerRow[0]?.userEnteredValue?.stringValue;
      if (!playerCell) continue;
      const player = playerCell.trim();
      const playerPicks = [];
      for (let c = start; c <= end; c++) {
        const roundNum = roundRow[c]?.userEnteredValue?.numberValue;
        if (!roundNum) continue;
        const cellVal = playerRow[c]?.userEnteredValue?.stringValue;
        if (!cellVal || cellVal.trim() === "") continue;
        const trimmed = cellVal.trim().toLowerCase();
        if (trimmed === "-" || trimmed === "np") {
          playerPicks.push({ r: Math.round(roundNum), t: "NP", w: false, np: true });
          continue;
        }
        const t = cellVal.trim();
        const color = getCellColor(playerRow, c);
        const w = color === "green" ? true : color === "red" ? false : null;
        playerPicks.push({ r: Math.round(roundNum), t, w });
      }
      if (playerPicks.length > 0) picks[player] = playerPicks;
    }
    result[season][gameKey] = { rounds, picks };
  });

  return result;
}

function getGameOutcome(picks) {
  return Object.entries(picks)
    .filter(([, ps]) => ps.length > 0 && !ps.some(p => p.w === false))
    .map(([name]) => name);
}

export default function App() {
  const [allData, setAllData] = useState(STATIC_DATA);
  const [loading, setLoading] = useState(true);
  const [liveError, setLiveError] = useState(false);
  const lastSeason = Object.keys(STATIC_DATA).at(-1);
  const lastGame = Object.keys(STATIC_DATA[lastSeason]).at(-1);
  const [season, setSeason] = useState(lastSeason);
  const [selectedGame, setSelectedGame] = useState(lastGame);
  const [activeTab, setActiveTab] = useState("grid");
  const [historyPlayer, setHistoryPlayer] = useState("Ed");
  const [recordsTab, setRecordsTab] = useState("best");
  const [teamView, setTeamView] = useState("ARS");
  const [historyMode, setHistoryMode] = useState("player");
  const [overallStats, setOverallStats] = useState([]);
  const [prizeTab, setPrizeTab] = useState("total");
  const [fixtures, setFixtures] = useState({ gameweek: null, fixtures: [] });
  const [allFixtures, setAllFixtures] = useState({});
  const [fixtureGW, setFixtureGW] = useState(null);

  useEffect(() => {
    Promise.all([fetchSheetData(), fetchOverallStats(), fetchFixtures(), fetchAllFixtures()])
      .then(([sheetData, stats, fixtureData, allFixtureData]) => {
        const parsed = parseSheetData(sheetData);
        const hasData = Object.values(parsed).some(s =>
          Object.values(s).some(game => Object.keys(game.picks).length > 0)
        );
        if (hasData) setAllData(parsed);
        if (stats.length > 0) setOverallStats(stats);
        if (fixtureData.fixtures && fixtureData.fixtures.length > 0) {
          setFixtures(fixtureData);
          setFixtureGW(fixtureData.gameweek);
        }
        if (Object.keys(allFixtureData).length > 0) {
          setAllFixtures(allFixtureData);
          if (fixtureData.gameweek) setFixtureGW(fixtureData.gameweek);
        }
        setLoading(false);
      })
      .catch(() => { setLiveError(true); setLoading(false); });
  }, []);

  const games = Object.keys(allData[season]);
  const gameData = allData[season][selectedGame];
  const rounds = gameData ? gameData.rounds : [];

  const entrants = useMemo(() => {
    if (!gameData) return [];
    return Object.entries(gameData.picks).map(([player, picks]) => ({
      player, picks, eliminated: picks.some(p => p.w === false),
      roundsLasted: picks.filter(p => p.w !== null).length,
    })).sort((a, b) => {
      if (!a.eliminated && !b.eliminated) return a.player.localeCompare(b.player);
      if (!a.eliminated) return -1;
      if (!b.eliminated) return 1;
      return b.roundsLasted - a.roundsLasted || a.player.localeCompare(b.player);
    });
  }, [gameData]);

  const survivors = useMemo(() => getGameOutcome(gameData ? gameData.picks : {}), [gameData]);

  const playerHistory = useMemo(() => {
    const teamMap = {};
    ["2024", "2025"].forEach(s => {
      Object.entries(allData[s]).forEach(([game, gd]) => {
        (gd.picks[historyPlayer] || []).forEach(pk => {
          if (pk.np) return;
          if (!teamMap[pk.t]) teamMap[pk.t] = { team: pk.t, picked: 0, wins: 0, losses: 0, usages: [] };
          teamMap[pk.t].picked++;
          if (pk.w === true) teamMap[pk.t].wins++;
          else if (pk.w === false) teamMap[pk.t].losses++;
          teamMap[pk.t].usages.push({ season: s, game, round: pk.r, result: pk.w });
        });
      });
    });
    return Object.values(teamMap).sort((a, b) => {
      const pctA = a.picked > 0 ? a.wins / a.picked : 0;
      const pctB = b.picked > 0 ? b.wins / b.picked : 0;
      return pctB - pctA || b.picked - a.picked;
    });
  }, [historyPlayer, allData]);

  const overallSuccess = useMemo(() => {
    return PLAYERS.map(player => {
      let wins = 0, losses = 0, gamesPlayed = 0;
      ["2024", "2025"].forEach(s => {
        Object.values(allData[s]).forEach(gd => {
          const picks = gd.picks[player];
          if (!picks || picks.length === 0) return;
          gamesPlayed++;
          picks.forEach(pk => {
            if (pk.np) return;
            if (pk.w === true) wins++;
            else if (pk.w === false) losses++;
          });
        });
      });
      const total = wins + losses;
      const pct = total > 0 ? Math.round(wins / total * 100) : 0;
      return { player, wins, losses, total, gamesPlayed, pct };
    }).filter(p => p.total > 0);
  }, [allData]);

  const teamStats = useMemo(() => {
    const teams = {};
    ["2024","2025"].forEach(s => {
      Object.values(allData[s]).forEach(gd => {
        Object.entries(gd.picks).forEach(([player, picks]) => {
          picks.forEach(pk => {
            if (pk.np || pk.t === "NP") return;
            if (!teams[pk.t]) teams[pk.t] = { team: pk.t, total: 0, wins: 0, losses: 0, players: {} };
            teams[pk.t].total++;
            if (pk.w === true) teams[pk.t].wins++;
            else if (pk.w === false) teams[pk.t].losses++;
            if (!teams[pk.t].players[player]) teams[pk.t].players[player] = { picked: 0, wins: 0, losses: 0, dots: [] };
            teams[pk.t].players[player].picked++;
            if (pk.w === true) teams[pk.t].players[player].wins++;
            else if (pk.w === false) teams[pk.t].players[player].losses++;
            teams[pk.t].players[player].dots.push(pk.w);
          });
        });
      });
    });
    return teams;
  }, [allData]);

  const teamRecords = useMemo(() => {
    const combos = {};
    ["2024", "2025"].forEach(s => {
      Object.values(allData[s]).forEach(gd => {
        Object.entries(gd.picks).forEach(([player, picks]) => {
          picks.forEach(pk => {
            if (pk.t === "NP" || pk.np) return;
            const key = player + "||" + pk.t;
            if (!combos[key]) combos[key] = { player, team: pk.t, picked: 0, wins: 0, losses: 0 };
            combos[key].picked++;
            if (pk.w === true) combos[key].wins++;
            else if (pk.w === false) combos[key].losses++;
          });
        });
      });
    });
    const qualified = Object.values(combos)
      .filter(c => c.picked >= 5)
      .map(c => ({ ...c, pct: Math.round(c.wins / c.picked * 100) }))
      .sort((a, b) => b.pct - a.pct || b.picked - a.picked);
    return { best: qualified.slice(0, 10), worst: [...qualified].reverse().slice(0, 10) };
  }, [allData]);


  const statsData = useMemo(() => {
    const allPicksByPlayer = {};
    const gwPicks = {};
    ["2024","2025"].forEach(s => {
      Object.entries(allData[s]).forEach(([game, gd]) => {
        Object.entries(gd.picks).forEach(([player, picks]) => {
          if (!allPicksByPlayer[player]) allPicksByPlayer[player] = [];
          picks.forEach(pk => {
            if (pk.np || pk.t === "NP") return;
            allPicksByPlayer[player].push({ season: s, game, r: pk.r, t: pk.t, w: pk.w });
            const key = s+"_"+game+"_R"+pk.r;
            if (!gwPicks[key]) gwPicks[key] = [];
            gwPicks[key].push([player, pk.t, pk.w]);
          });
        });
      });
    });

    // 1. Longest winning streak
    const winStreaks = Object.entries(allPicksByPlayer).map(([player, picks]) => {
      let streak = 0, best = 0, bestEnd = null;
      picks.forEach(pk => {
        if (pk.w === true) { streak++; if (streak > best) { best = streak; bestEnd = pk; } }
        else if (pk.w === false) streak = 0;
      });
      return { player, streak: best, end: bestEnd };
    }).sort((a,b) => b.streak - a.streak);

    // 2. Longest losing streak
    const loseStreaks = Object.entries(allPicksByPlayer).map(([player, picks]) => {
      let streak = 0, best = 0, bestEnd = null;
      picks.forEach(pk => {
        if (pk.w === false) { streak++; if (streak > best) { best = streak; bestEnd = pk; } }
        else if (pk.w === true) streak = 0;
      });
      return { player, streak: best, end: bestEnd };
    }).sort((a,b) => b.streak - a.streak);

    // 3. Current active streak
    const activeStreaks = Object.entries(allPicksByPlayer).map(([player, picks]) => {
      let streak = 0;
      for (let i = picks.length - 1; i >= 0; i--) {
        if (picks[i].w === true) streak++;
        else if (picks[i].w === false) break;
      }
      return { player, streak };
    }).filter(x => x.streak > 0).sort((a,b) => b.streak - a.streak);

    // 4. Biggest team obsession
    const obsessions = Object.entries(allPicksByPlayer).map(([player, picks]) => {
      const tc = {};
      picks.forEach(pk => { tc[pk.t] = (tc[pk.t]||0) + 1; });
      const top = Object.entries(tc).sort((a,b) => b[1]-a[1])[0];
      return { player, team: top[0], count: top[1] };
    }).sort((a,b) => b.count - a.count);

    // 5+6. Contrarian & follower
    const contrScore = {}, totalGws = {};
    Object.entries(gwPicks).forEach(([gw, picks]) => {
      if (picks.length < 3) return;
      const tc = {};
      picks.forEach(([,team]) => { tc[team] = (tc[team]||0) + 1; });
      const maxPop = Math.max(...Object.values(tc));
      picks.forEach(([player, team]) => {
        totalGws[player] = (totalGws[player]||0) + 1;
        if (tc[team] < maxPop) contrScore[player] = (contrScore[player]||0) + 1;
      });
    });
    const contrarian = Object.keys(totalGws)
      .filter(p => totalGws[p] >= 10)
      .map(p => ({ player: p, score: contrScore[p]||0, total: totalGws[p], pct: Math.round(((contrScore[p]||0)/totalGws[p])*100) }))
      .sort((a,b) => b.pct - a.pct);
    const follower = Object.keys(totalGws)
      .filter(p => totalGws[p] >= 10)
      .map(p => ({ player: p, score: totalGws[p]-(contrScore[p]||0), total: totalGws[p], pct: Math.round(((totalGws[p]-(contrScore[p]||0))/totalGws[p])*100) }))
      .sort((a,b) => b.pct - a.pct);

    // 7. Bloodiest GW
    const elimGw = {};
    Object.entries(gwPicks).forEach(([gw, picks]) => {
      picks.forEach(([,, w]) => { if (w === false) elimGw[gw] = (elimGw[gw]||0) + 1; });
    });
    const bloodyGw = Object.entries(elimGw).sort((a,b) => b[1]-a[1]).slice(0,1)
      .map(([gw, count]) => ({ gw: gw.replace(/_R/," GW").replace(/_/," ").replace("Game ","Round "), count }));

    // 8. Crowd win rate
    let crowdWins = 0, crowdTotal = 0;
    Object.entries(gwPicks).forEach(([gw, picks]) => {
      if (picks.length < 3) return;
      const tc = {};
      picks.forEach(([,team]) => { tc[team] = (tc[team]||0) + 1; });
      const topTeam = Object.entries(tc).sort((a,b) => b[1]-a[1])[0][0];
      const results = picks.filter(([,t,w]) => t === topTeam && w !== null).map(([,,w]) => w);
      if (results.length) { crowdTotal++; if (results[0] === true) crowdWins++; }
    });

    // 9. Most games entered
    const gamesEntered = {};
    ["2024","2025"].forEach(s => {
      Object.entries(allData[s]).forEach(([game, gd]) => {
        Object.keys(gd.picks).forEach(p => { gamesEntered[p] = (gamesEntered[p]||0) + 1; });
      });
    });
    const mostGames = Object.entries(gamesEntered).sort((a,b) => b[1]-a[1]);

    // 10. Most total picks
    const mostPicks = Object.entries(allPicksByPlayer).map(([p, picks]) => ({ player: p, count: picks.length })).sort((a,b) => b.count - a.count);

    // 11. Most identical picks
    const pairMatches = {}, pairTotal = {};
    Object.values(gwPicks).forEach(picks => {
      for (let i = 0; i < picks.length; i++) {
        for (let j = i+1; j < picks.length; j++) {
          const key = [picks[i][0], picks[j][0]].sort().join("||");
          pairTotal[key] = (pairTotal[key]||0) + 1;
          if (picks[i][1] === picks[j][1]) pairMatches[key] = (pairMatches[key]||0) + 1;
        }
      }
    });
    const topPairs = Object.entries(pairMatches)
      .filter(([k]) => pairTotal[k] >= 10)
      .map(([k,v]) => ({ pair: k.split("||"), matches: v, total: pairTotal[k], pct: Math.round(v/pairTotal[k]*100) }))
      .sort((a,b) => b.pct - a.pct);

    return { winStreaks, loseStreaks, activeStreaks, obsessions, contrarian, follower, bloodyGw, crowdWins, crowdTotal, mostGames, mostPicks, topPairs };
  }, [allData]);

  const prizeData = useMemo(() => {
    const ENTRY = 10;
    const games = [];
    let rolledOver = 0;
    ["2024", "2025"].forEach(s => {
      Object.entries(allData[s]).forEach(([game, gd]) => {
        const outcome = PRIZE_OUTCOMES[s][game];
        const ents = Object.values(gd.picks).filter(p => p.length > 0).length;
        const gamePot = ents * ENTRY;
        const totalPot = gamePot + rolledOver;
        let winnings = {};
        if (outcome.result === "win") {
          winnings[outcome.winners[0]] = totalPot; rolledOver = 0;
        } else if (outcome.result === "split") {
          const share = totalPot / outcome.winners.length;
          outcome.winners.forEach(w => { winnings[w] = share; }); rolledOver = 0;
        } else if (outcome.result === "rollover") {
          rolledOver = totalPot;
        }
        games.push({ season: s, game, entrants: ents, gamePot, rolledOver: outcome.result === "rollover" ? totalPot : 0, totalPot, outcome: outcome.result, winners: outcome.winners, winnings });
      });
    });
    const playerTotals = {};
    PLAYERS.forEach(p => { playerTotals[p] = { spent: 0, won: 0, gamesEntered: 0 }; });
    games.forEach(g => {
      Object.keys(allData[g.season][g.game].picks).forEach(p => {
        if (!playerTotals[p]) playerTotals[p] = { spent: 0, won: 0, gamesEntered: 0 };
        playerTotals[p].spent += 10; playerTotals[p].gamesEntered++;
      });
      Object.entries(g.winnings).forEach(([p, amt]) => {
        if (!playerTotals[p]) playerTotals[p] = { spent: 0, won: 0, gamesEntered: 0 };
        playerTotals[p].won += amt;
      });
    });
    const leaderboard = Object.entries(playerTotals)
      .filter(([, v]) => v.gamesEntered > 0)
      .map(([player, v]) => ({ player, ...v, net: v.won - v.spent }))
      .sort((a, b) => b.net - a.net);
    return { games, leaderboard };
  }, [allData]);

  const C = {
    bg:"#080c15", surface:"#0d1525", border:"#1a2a45",
    accent:"#7aacff", green:"#22c55e", red:"#ef4444", amber:"#f59e0b",
    text:"#c8d8f0", muted:"#4a5a7a",
  };

  const pill = (on) => ({
    padding:"4px 10px", borderRadius:20, cursor:"pointer", fontFamily:"inherit",
    fontSize:9, letterSpacing:"1.2px", textTransform:"uppercase",
    border:`1px solid ${on ? C.accent+"80" : C.border}`,
    background: on ? "#0f2050" : "transparent",
    color: on ? C.accent : C.muted, transition:"all .15s",
  });

  const tabBtn = (on) => ({
    padding:"8px 12px", cursor:"pointer", fontFamily:"inherit",
    fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase",
    border:"none", background:"transparent",
    color: on ? C.accent : C.muted,
    borderBottom:`2px solid ${on ? C.accent : "transparent"}`,
    transition:"all .15s",
  });

  const card = (extra) => ({
    background:C.surface, border:`1px solid ${C.border}`,
    borderRadius:8, padding:"10px 12px", ...extra,
  });

  const tbadge = (team) => ({
    display:"inline-flex", alignItems:"center", padding:"2px 6px",
    borderRadius:4, fontSize:10, fontWeight:600,
    background:`${TEAM_COLORS[team]||"#1a2a45"}28`,
    border:`1px solid ${TEAM_COLORS[team]||"#1a2a45"}55`,
    color:TEAM_COLORS[team]||C.muted,
    minWidth:34, justifyContent:"center",
  });

  const pickCell = (pk) => ({
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    padding:"2px 5px", borderRadius:4, fontSize:10, fontWeight:600, minWidth:36,
    background:pk.w===true?"#14532d":pk.w===false?"#450a0a":"#1a2a45",
    color:pk.w===true?"#4ade80":pk.w===false?"#fca5a5":C.amber,
    border:`1px solid ${pk.w===true?"#16653490":pk.w===false?"#7f1d1d90":"#f59e0b40"}`,
  });

  return (
    <div style={{ fontFamily:"'DM Mono','Courier New',monospace", background:C.bg, minHeight:"100vh", color:C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#080c15;}
        ::-webkit-scrollbar-thumb{background:#1e3055;border-radius:2px;}
        button:focus{outline:none;}
        select{background:#0d1525;color:#c8d8f0;border:1px solid #1a2a45;border-radius:6px;padding:5px 8px;font-family:inherit;font-size:10px;cursor:pointer;}
        tr:hover td{background:#0f1d35!important;}
      `}</style>

      <div style={{ background:"#060a12", borderBottom:`1px solid ${C.border}`, padding:"12px 20px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:4, color:C.accent, lineHeight:1 }}>WINNER TAKES ALL</div>
            <div style={{ fontSize:8, color:"#2a3a5a", letterSpacing:2, marginTop:2 }}>LAST MAN STANDING TRACKER</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {loading && <span style={{ fontSize:9, color:C.amber }}>⟳ syncing...</span>}
            {liveError && <span style={{ fontSize:9, color:C.muted }}>offline mode</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1000, margin:"0 auto", padding:"16px" }}>
        <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:18, overflowX:"auto" }}>
          {[["grid","Picks Grid"],["success","Success Rate"],["history","Pick History"],["stats","Stats"],["prize","Prize Money"]].map(([v,l]) => (
            <button key={v} style={tabBtn(activeTab===v)} onClick={()=>setActiveTab(v)}>{l}</button>
          ))}
        </div>

        {activeTab==="grid" && (
          <div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {["2024","2025"].map(s => (
                <button key={s} style={pill(season===s)} onClick={()=>{ setSeason(s); setSelectedGame(Object.keys(allData[s])[0]); }}>
                  {s === "2024" ? "24/25" : "25/26"}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
              {games.map(g => <button key={g} style={pill(selectedGame===g)} onClick={()=>setSelectedGame(g)}>{g.replace("Game","Round")}</button>)}
            </div>
            {fixtures.fixtures && fixtures.fixtures.length > 0 && (
              <div style={{ overflow:"hidden", marginBottom:14 }}>
                <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, marginBottom:8 }}>GW{fixtures.gameweek} FIXTURES</div>
                <div style={{ overflow:"hidden", position:"relative" }}>
                  <style>{`
                    @keyframes scroll {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-50%); }
                    }
                    .carousel-track {
                      display: flex;
                      gap: 8px;
                      animation: scroll 30s linear infinite;
                      width: max-content;
                    }
                    .carousel-track:hover {
                      animation-play-state: paused;
                    }
                  `}</style>
                  <div className="carousel-track">
                    {[...fixtures.fixtures, ...fixtures.fixtures].map((f, i) => {
                      const d = new Date(f.date);
                      const day = d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
                      const time = d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
                      const hasScore = f.homeScore !== null && f.homeScore !== undefined;
                      return (
                        <div key={i} style={{
                          background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
                          padding:"8px 10px", flexShrink:0, minWidth:140, textAlign:"center",
                        }}>
                          <div style={{ fontSize:8, color:C.muted, marginBottom:6 }}>{day}</div>
                          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:2 }}>{f.home}</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:hasScore?C.accent:C.muted, margin:"4px 0" }}>
                            {hasScore ? `${f.homeScore} - ${f.awayScore}` : time}
                          </div>
                          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginTop:2 }}>{f.away}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

                        {gameData && (
              <div>
                <div style={{ ...card({ marginBottom:14, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }) }}>
                  <div>
                    <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:3 }}>Round Outcome</div>
                    <div style={{ fontSize:11, color:season==="2025"&&selectedGame==="Game 10"?C.amber:survivors.length===0?C.red:C.green, fontWeight:500 }}>
                      survivors.length===0?"🔴 Rollover — no survivors":survivors.length===1?"🏆 Winner: "+survivors[0]:"🤝 Split: "+survivors.join(" & ")}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:16, marginLeft:"auto" }}>
                    {[{l:"Entered",v:entrants.length,c:C.accent},{l:"Survived",v:survivors.length,c:C.green},{l:"Eliminated",v:entrants.filter(e=>e.eliminated).length,c:C.red}].map(s=>(
                      <div key={s.l} style={{ textAlign:"center" }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:s.c, lineHeight:1 }}>{s.v}</div>
                        <div style={{ fontSize:8, color:C.muted, letterSpacing:1.2, textTransform:"uppercase" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ borderCollapse:"collapse", width:"100%", fontSize:11 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign:"left", padding:"6px 10px", color:C.muted, fontSize:9, fontWeight:400, borderBottom:`1px solid ${C.border}`, position:"sticky", left:0, background:C.bg, minWidth:80, zIndex:2 }}>PLAYER</th>
                        {rounds.map(r => (
                          <th key={r} style={{ padding:"6px 3px", color:C.muted, fontSize:9, fontWeight:400, borderBottom:`1px solid ${C.border}`, textAlign:"center", minWidth:44 }}>GW{r}</th>
                        ))}
                        <th style={{ padding:"6px 6px", color:C.muted, fontSize:9, fontWeight:400, borderBottom:`1px solid ${C.border}`, textAlign:"center" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entrants.map(({player,picks,eliminated}) => (
                        <tr key={player}>
                          <td style={{ padding:"5px 10px", borderBottom:"1px solid #0d1a2e", position:"sticky", left:0, background:C.surface, zIndex:1, fontWeight:500, color:eliminated?C.muted:C.text, whiteSpace:"nowrap", fontSize:11 }}>{player}</td>
                          {rounds.map(r => {
                            const pk = picks.find(p => p.r===r);
                            return (
                              <td key={r} style={{ padding:"3px 2px", borderBottom:"1px solid #0d1a2e", textAlign:"center" }}>
                                {pk ? (pk.t==="NP" ?
                                  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"2px 5px", borderRadius:4, fontSize:9, fontWeight:600, minWidth:34, background:"#2a1a00", color:C.amber, border:"1px solid #7f4f0090" }}>N/P</span>
                                  : <span style={pickCell(pk)}>{pk.t}</span>)
                                  : <span style={{ color:"#1e2d45" }}>—</span>}
                              </td>
                            );
                          })}
                          <td style={{ padding:"4px 6px", borderBottom:"1px solid #0d1a2e", textAlign:"center" }}>
                            <span style={{ fontSize:8, letterSpacing:1, color:eliminated?C.red:C.green, fontWeight:600 }}>{eliminated?"OUT":"IN ✓"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {Object.keys(allFixtures).length > 0 && (
              <div style={{ marginTop:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <button onClick={()=>setFixtureGW(gw=>Math.max(1,gw-1))} style={{ ...pill(false), padding:"4px 8px" }}>←</button>
                  <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, flex:1, textAlign:"center" }}>GAMEWEEK {fixtureGW}</div>
                  <button onClick={()=>setFixtureGW(gw=>Math.min(38,gw+1))} style={{ ...pill(false), padding:"4px 8px" }}>→</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {(allFixtures[fixtureGW]||[]).map((f,i) => {
                    const d = new Date(f.date);
                    const day = d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
                    const time = d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
                    const hasScore = f.homeScore !== null && f.homeScore !== undefined;
                    const isLive = f.status === "IN_PLAY" || f.status === "PAUSED";
                    return (
                      <div key={i} style={{ background:C.surface, border:`1px solid ${isLive?C.green:C.border}`, borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ fontSize:9, color:C.muted, minWidth:80 }}>{day} {time}</div>
                        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                          <span style={{ fontSize:11, fontWeight:600, color:C.text, flex:1, textAlign:"right" }}>{f.home}</span>
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:hasScore?C.accent:isLive?C.green:C.muted, minWidth:50, textAlign:"center" }}>
                            {hasScore ? `${f.homeScore}-${f.awayScore}` : isLive ? "LIVE" : "vs"}
                          </span>
                          <span style={{ fontSize:11, fontWeight:600, color:C.text, flex:1 }}>{f.away}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab==="success" && (
          <div>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:14 }}>PICK SUCCESS RATE — ALL SEASONS · ALL ROUNDS</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {[...overallSuccess].sort((a,b) => b.pct-a.pct||b.total-a.total).map((p,i) => {
                const barColor = p.pct>=80?C.green:p.pct>=60?"#84cc16":p.pct>=40?C.amber:C.red;
                return (
                  <div key={p.player} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i<3?C.amber:C.muted, width:18, flexShrink:0 }}>{i+1}</span>
                      <span style={{ fontWeight:500, color:C.text, fontSize:11, flex:1 }}>{p.player}</span>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:barColor, lineHeight:1 }}>{p.pct}%</span>
                    </div>
                    <div style={{ height:5, background:"#111d30", borderRadius:3, overflow:"hidden", marginBottom:6 }}>
                      <div style={{ height:"100%", width:`${p.pct}%`, background:barColor, borderRadius:3, transition:"width .5s" }}/>
                    </div>
                    <div style={{ display:"flex", gap:12, fontSize:10 }}>
                      <span style={{ color:C.green }}>✓ {p.wins}</span>
                      <span style={{ color:C.red }}>✗ {p.losses}</span>
                      <span style={{ color:C.muted }}>{p.total} picks</span>
                      <span style={{ color:C.muted }}>{p.gamesPlayed} games</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab==="history" && (
          <div>
            <div style={{ display:"flex", gap:0, marginBottom:14, borderBottom:`1px solid ${C.border}` }}>
              {[["player","Player Picks"],["team","Team Picks"]].map(([v,l]) => (
                <button key={v} onClick={()=>setHistoryMode(v)} style={{
                  flex:1, padding:"9px 0", cursor:"pointer", fontFamily:"inherit",
                  fontSize:9, letterSpacing:1.5, textTransform:"uppercase", border:"none",
                  background:historyMode===v?"#0f2050":"transparent",
                  color:historyMode===v?C.accent:C.muted,
                  borderBottom:`2px solid ${historyMode===v?C.accent:"transparent"}`,
                  transition:"all .2s",
                }}>{l}</button>
              ))}
            </div>

            {historyMode==="player" && (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                  <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5 }}>PLAYER</div>
                  <select value={historyPlayer} onChange={e=>setHistoryPlayer(e.target.value)}>
                    {PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {playerHistory.length>0 && (
                    <div style={{ display:"flex", gap:12, marginLeft:"auto", fontSize:10 }}>
                      <span style={{ color:C.accent }}>{playerHistory.reduce((a,t)=>a+t.picked,0)} picks</span>
                      <span style={{ color:C.green }}>✓{playerHistory.reduce((a,t)=>a+t.wins,0)}</span>
                      <span style={{ color:C.red }}>✗{playerHistory.reduce((a,t)=>a+t.losses,0)}</span>
                      <span style={{ color:"#a78bfa" }}>{playerHistory.length} teams</span>
                    </div>
                  )}
                </div>
                {playerHistory.length===0 ? (
                  <div style={{ color:C.border, textAlign:"center", padding:"40px 0" }}>No picks found for {historyPlayer}</div>
                ) : (
                  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                    <table style={{ borderCollapse:"collapse", width:"100%", fontSize:10 }}>
                      <thead>
                        <tr style={{ background:"#060a12" }}>
                          {[["TEAM","left","10px"],["x","center","6px"],["W","center","6px"],["L","center","6px"],["RATE","left","8px"],["% ","right","8px"],["HISTORY","left","10px"]].map(([h,a,p]) => (
                            <th key={h} style={{ padding:`7px ${p}`, textAlign:a, color:C.muted, fontSize:8, fontWeight:400, letterSpacing:1.2, borderBottom:`1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {playerHistory.map(({team,picked,wins,losses,usages}) => {
                          const pct = picked>0?Math.round(wins/picked*100):0;
                          const barColor = pct===100?C.green:pct>50?"#84cc16":C.amber;
                          const dots = [...Array(wins).fill(true),...Array(losses).fill(false)];
                          return (
                            <tr key={team} style={{ borderBottom:"1px solid #0d1a2e" }}>
                              <td style={{ padding:"6px 10px", whiteSpace:"nowrap" }}><span style={tbadge(team)}>{team}</span></td>
                              <td style={{ padding:"6px 6px", textAlign:"center", color:C.muted }}>{picked}</td>
                              <td style={{ padding:"6px 6px", textAlign:"center", color:C.green, fontWeight:600 }}>{wins}</td>
                              <td style={{ padding:"6px 6px", textAlign:"center", color:C.red, fontWeight:600 }}>{losses}</td>
                              <td style={{ padding:"6px 8px", minWidth:80 }}>
                                <div style={{ height:4, background:"#111d30", borderRadius:2, overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:2 }}/>
                                </div>
                              </td>
                              <td style={{ padding:"6px 8px", textAlign:"right", fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:barColor, whiteSpace:"nowrap" }}>{pct}%</td>
                              <td style={{ padding:"6px 10px" }}>
                                <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                                  {dots.map((w,j) => (
                                    <span key={j} title={usages[j]?`${usages[j].season} ${usages[j].game.replace("Game","Round")} GW${usages[j].round}`:""} style={{ width:7, height:7, borderRadius:"50%", background:w?C.green:C.red, display:"inline-block", flexShrink:0, opacity:0.9 }}/>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {historyMode==="team" && (
              <div>
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:14 }}>
                  <table style={{ borderCollapse:"collapse", width:"100%", fontSize:10 }}>
                    <thead>
                      <tr style={{ background:"#060a12" }}>
                        {[["TEAM","left","10px"],["PICKED","center","6px"],["W","center","6px"],["L","center","6px"],["RATE","left","8px"],["% ","right","8px"]].map(([h,a,p]) => (
                          <th key={h} style={{ padding:`7px ${p}`, textAlign:a, color:C.muted, fontSize:8, fontWeight:400, letterSpacing:1.2, borderBottom:`1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(teamStats)
                        .map(([team, td]) => ({ team, ...td, pct: td.total > 0 ? Math.round(td.wins / td.total * 100) : 0 }))
                        .sort((a, b) => b.pct - a.pct || b.total - a.total)
                        .map(({ team, total, wins, losses, pct }) => {
                          const barColor = pct>=80?C.green:pct>=60?"#84cc16":pct>=40?C.amber:C.red;
                          return (
                            <tr key={team} style={{ borderBottom:"1px solid #0d1a2e", cursor:"pointer" }} onClick={()=>setTeamView(team)}>
                              <td style={{ padding:"6px 10px", whiteSpace:"nowrap" }}><span style={tbadge(team)}>{team}</span></td>
                              <td style={{ padding:"6px 6px", textAlign:"center", color:C.muted }}>{total}</td>
                              <td style={{ padding:"6px 6px", textAlign:"center", color:C.green, fontWeight:600 }}>{wins}</td>
                              <td style={{ padding:"6px 6px", textAlign:"center", color:C.red, fontWeight:600 }}>{losses}</td>
                              <td style={{ padding:"6px 8px", minWidth:80 }}>
                                <div style={{ height:4, background:"#111d30", borderRadius:2, overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:2 }}/>
                                </div>
                              </td>
                              <td style={{ padding:"6px 8px", textAlign:"right", fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:barColor, whiteSpace:"nowrap" }}>{pct}%</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:14 }}>
                  {Object.keys(teamStats).sort().map(t => (
                    <button key={t} style={pill(teamView===t)} onClick={()=>setTeamView(t)}>{t}</button>
                  ))}
                </div>
                {teamStats[teamView] && (() => {
                  const td = teamStats[teamView];
                  const pct = td.total > 0 ? Math.round(td.wins / td.total * 100) : 0;
                  const barColor = pct>=80?C.green:pct>=60?"#84cc16":pct>=40?C.amber:C.red;
                  const players = Object.entries(td.players)
                    .map(([player, v]) => ({ player, ...v, pct: v.picked > 0 ? Math.round(v.wins / v.picked * 100) : 0 }))
                    .sort((a, b) => b.pct - a.pct || b.picked - a.picked);
                  return (
                    <div>
                      <div style={{ ...card({ marginBottom:14, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }) }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:3 }}>{ABBR_FULL[teamView]||teamView} — all players</div>
                          <div style={{ height:5, background:"#111d30", borderRadius:3, overflow:"hidden", marginTop:8 }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:3 }}/>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:16 }}>
                          {[{l:"Picked",v:td.total,c:C.accent},{l:"Wins",v:td.wins,c:C.green},{l:"Losses",v:td.losses,c:C.red},{l:"Win %",v:pct+"%",c:barColor}].map(s=>(
                            <div key={s.l} style={{ textAlign:"center" }}>
                              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:s.c, lineHeight:1 }}>{s.v}</div>
                              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.2, textTransform:"uppercase" }}>{s.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                        <table style={{ borderCollapse:"collapse", width:"100%", fontSize:10 }}>
                          <thead>
                            <tr style={{ background:"#060a12" }}>
                              {[["PLAYER","left","10px"],["x","center","6px"],["W","center","6px"],["L","center","6px"],["RATE","left","8px"],["% ","right","8px"],["HISTORY","left","10px"]].map(([h,a,p]) => (
                                <th key={h} style={{ padding:`7px ${p}`, textAlign:a, color:C.muted, fontSize:8, fontWeight:400, letterSpacing:1.2, borderBottom:`1px solid ${C.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {players.map(({player, picked, wins, losses, dots, pct}) => {
                              const barColor = pct===100?C.green:pct>50?"#84cc16":C.amber;
                              return (
                                <tr key={player} style={{ borderBottom:"1px solid #0d1a2e" }}>
                                  <td style={{ padding:"6px 10px", fontWeight:500, color:C.text, fontSize:11 }}>{player}</td>
                                  <td style={{ padding:"6px 6px", textAlign:"center", color:C.muted }}>{picked}</td>
                                  <td style={{ padding:"6px 6px", textAlign:"center", color:C.green, fontWeight:600 }}>{wins}</td>
                                  <td style={{ padding:"6px 6px", textAlign:"center", color:C.red, fontWeight:600 }}>{losses}</td>
                                  <td style={{ padding:"6px 8px", minWidth:80 }}>
                                    <div style={{ height:4, background:"#111d30", borderRadius:2, overflow:"hidden" }}>
                                      <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:2 }}/>
                                    </div>
                                  </td>
                                  <td style={{ padding:"6px 8px", textAlign:"right", fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:barColor, whiteSpace:"nowrap" }}>{pct}%</td>
                                  <td style={{ padding:"6px 10px" }}>
                                    <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                                      {dots.map((w,j) => (
                                        <span key={j} style={{ width:7, height:7, borderRadius:"50%", background:w===true?C.green:w===false?C.red:C.amber, display:"inline-block", flexShrink:0, opacity:0.9 }}/>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab==="records" && (
          <div>
            <div style={{ display:"flex", gap:0, marginBottom:14, borderBottom:`1px solid ${C.border}` }}>
              {[["best","🏆 Hall of Fame"],["worst","💀 Hall of Shame"]].map(([v,l]) => (
                <button key={v} onClick={()=>setRecordsTab(v)} style={{
                  flex:1, padding:"9px 0", cursor:"pointer", fontFamily:"inherit",
                  fontSize:9, letterSpacing:1.5, textTransform:"uppercase", border:"none",
                  background:recordsTab===v?(v==="best"?"#0a2a18":"#2a0a0a"):"transparent",
                  color:recordsTab===v?(v==="best"?"#22c55e":C.red):C.muted,
                  borderBottom:`2px solid ${recordsTab===v?(v==="best"?"#22c55e":C.red):"transparent"}`,
                  transition:"all .2s",
                }}>{l}</button>
              ))}
            </div>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>
              {recordsTab==="best"?"BEST":"WORST"} PLAYER-TEAM COMBOS · MIN 5 PICKS · ALL SEASONS
            </div>
            <div style={{ display:"flex", flexDirection:"column" }}>
              {(recordsTab==="best"?teamRecords.best:teamRecords.worst).map((d,i) => {
                const color = TEAM_COLORS[d.team]||"#888";
                const pctColor = recordsTab==="best"
                  ?(d.pct===100?C.green:d.pct>=85?"#84cc16":C.amber)
                  :(d.pct<=14?C.red:d.pct<=40?"#f97316":C.amber);
                const dots = [...Array(d.wins).fill(true),...Array(d.losses).fill(false)];
                return (
                  <div key={d.player+d.team} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 0", borderBottom:"1px solid #0d1a2e" }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted, width:20, flexShrink:0, paddingTop:1, textAlign:"right" }}>{i+1}</div>
                    <div style={{ background:`${color}18`, border:`1px solid ${color}50`, borderRadius:4, padding:"2px 6px", fontSize:9, fontWeight:700, color, flexShrink:0, letterSpacing:0.5, marginTop:1, minWidth:32, textAlign:"center" }}>{d.team}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:C.text }}>{d.player}</div>
                      <div style={{ fontSize:9, color:C.muted, marginTop:1 }}>{ABBR_FULL[d.team]||d.team} · {d.picked} picks</div>
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:5 }}>
                        {dots.map((w,j) => (
                          <span key={j} style={{ width:7, height:7, borderRadius:"50%", background:w?C.green:C.red, display:"inline-block", flexShrink:0, opacity:0.9 }}/>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:pctColor, lineHeight:1, flexShrink:0, paddingTop:1, textShadow:`0 0 16px ${pctColor}50` }}>{d.pct}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:14, marginTop:14, paddingTop:12, borderTop:"1px solid #0d1a2e" }}>
              {[["#22c55e","Win"],["#ef4444","Loss"]].map(([col,label]) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:9, color:C.muted }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:col, display:"inline-block" }}/>{label}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==="stats" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>

            {/* 1. Longest winning streak */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🏆 Longest Winning Streak</div>
              {statsData.winStreaks.slice(0,1).map((s,i) => (
                <div key={s.player}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.green, lineHeight:1 }}>{s.streak}</span>
                    <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{s.player}</span>
                  </div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>consecutive wins — ended {s.end.season==="2024"?"24/25":"25/26"} {s.end.game.replace("Game","Round")} GW{s.end.r}</div>
                </div>
              ))}
            </div>

            {/* 2. Longest losing streak */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>💀 Longest Losing Streak</div>
              {statsData.loseStreaks.slice(0,1).map((s,i) => (
                <div key={s.player}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.red, lineHeight:1 }}>{s.streak}</span>
                    <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{s.player}</span>
                  </div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>consecutive losses — ended {s.end.season==="2024"?"24/25":"25/26"} {s.end.game.replace("Game","Round")} GW{s.end.r}</div>
                </div>
              ))}
            </div>

            {/* 3. Current active streak */}
            {statsData.activeStreaks.length > 0 && (
              <div style={card({})}>
                <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>⚡ Current Active Streak</div>
                {statsData.activeStreaks.slice(0,1).map(s => (
                  <div key={s.player}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.amber, lineHeight:1 }}>{s.streak}</span>
                      <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{s.player}</span>
                    </div>
                    <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>wins in a row and counting</div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. Team obsession */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>❤️ Biggest Team Obsession</div>
              {statsData.obsessions.slice(0,1).map(s => (
                <div key={s.player}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:TEAM_COLORS[s.team]||C.accent, lineHeight:1 }}>{s.count}x</span>
                    <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{s.player} — <span style={tbadge(s.team)}>{s.team}</span></span>
                  </div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>most times picking the same team</div>
                </div>
              ))}
            </div>

            {/* 5. Most contrarian */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🦅 Most Contrarian Picker</div>
              {statsData.contrarian.slice(0,3).map((s,i) => (
                <div key={s.player} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:i<2?8:0 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":"#CD7F32", width:16, flexShrink:0 }}>{i+1}</span>
                  <span style={{ flex:1, fontSize:11, color:C.text, fontWeight:i===0?600:400 }}>{s.player}</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.accent }}>{s.pct}%</span>
                </div>
              ))}
              <div style={{ fontSize:9, color:C.muted, marginTop:8 }}>% of GWs picked against the crowd</div>
            </div>

            {/* 6. Biggest crowd follower */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🐑 Biggest Crowd Follower</div>
              {statsData.follower.slice(0,3).map((s,i) => (
                <div key={s.player} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:i<2?8:0 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":"#CD7F32", width:16, flexShrink:0 }}>{i+1}</span>
                  <span style={{ flex:1, fontSize:11, color:C.text, fontWeight:i===0?600:400 }}>{s.player}</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.accent }}>{s.pct}%</span>
                </div>
              ))}
              <div style={{ fontSize:9, color:C.muted, marginTop:8 }}>% of GWs picked with the crowd</div>
            </div>

            {/* 7. Bloodiest GW */}
            {statsData.bloodyGw.length > 0 && (
              <div style={card({})}>
                <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🩸 Bloodiest Gameweek</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.red, lineHeight:1 }}>{statsData.bloodyGw[0].count}</span>
                  <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{statsData.bloodyGw[0].gw}</span>
                </div>
                <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>players eliminated in a single gameweek</div>
              </div>
            )}

            {/* 8. Crowd win rate */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>👥 Does The Crowd Pick Win?</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.green, lineHeight:1 }}>{Math.round(statsData.crowdWins/statsData.crowdTotal*100)}%</span>
                <span style={{ fontSize:11, color:C.text }}>of the time</span>
              </div>
              <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>{statsData.crowdWins} wins out of {statsData.crowdTotal} gameweeks</div>
            </div>

            {/* 9. Most games entered */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>📅 Most Games Entered</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.accent, lineHeight:1 }}>{statsData.mostGames[0][1]}</span>
                <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{statsData.mostGames.filter(([,c]) => c === statsData.mostGames[0][1]).map(([p]) => p).join(", ")}</span>
              </div>
              <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>rounds entered across all seasons</div>
            </div>

            {/* 10. Most total picks */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🎯 Most Total Picks</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.accent, lineHeight:1 }}>{statsData.mostPicks[0].count}</span>
                <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{statsData.mostPicks.filter(p => p.count === statsData.mostPicks[0].count).map(p => p.player).join(", ")}</span>
              </div>
              <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>total selections made across all rounds</div>
            </div>

            {/* 11. Most identical picks */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🤝 Most Identical Picks</div>
              {statsData.topPairs.slice(0,1).map(p => (
                <div key={p.pair.join("&")}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:C.accent, lineHeight:1 }}>{p.pct}%</span>
                    <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{p.pair[0]} & {p.pair[1]}</span>
                  </div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>same pick in {p.matches} of {p.total} shared gameweeks</div>
                </div>
              ))}
            </div>


            {/* 12. Hall of Fame */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🏆 Hall of Fame — Best Player/Team</div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                {teamRecords.best.slice(0,3).map((d,i) => {
                  const color = TEAM_COLORS[d.team]||"#888";
                  const pctColor = d.pct===100?C.green:d.pct>=85?"#84cc16":C.amber;
                  const dots = [...Array(d.wins).fill(true),...Array(d.losses).fill(false)];
                  return (
                    <div key={d.player+d.team} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 0", borderBottom:i<2?"1px solid #0d1a2e":"none" }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:i===0?"#FFD700":i===1?"#C0C0C0":"#CD7F32", width:20, flexShrink:0, paddingTop:1, textAlign:"right" }}>{i+1}</div>
                      <div style={{ background:`${color}18`, border:`1px solid ${color}50`, borderRadius:4, padding:"2px 6px", fontSize:9, fontWeight:700, color, flexShrink:0, marginTop:1, minWidth:32, textAlign:"center" }}>{d.team}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:C.text }}>{d.player}</div>
                        <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:4 }}>
                          {dots.map((w,j) => <span key={j} style={{ width:7, height:7, borderRadius:"50%", background:w?C.green:C.red, display:"inline-block", flexShrink:0, opacity:0.9 }}/>)}
                        </div>
                      </div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:pctColor, lineHeight:1, flexShrink:0, paddingTop:1 }}>{d.pct}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize:9, color:C.muted, marginTop:8 }}>min 5 picks · all seasons</div>
            </div>

            {/* 13. Hall of Shame */}
            <div style={card({})}>
              <div style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>💀 Hall of Shame — Worst Player/Team</div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                {teamRecords.worst.slice(0,3).map((d,i) => {
                  const color = TEAM_COLORS[d.team]||"#888";
                  const pctColor = d.pct<=14?C.red:d.pct<=40?"#f97316":C.amber;
                  const dots = [...Array(d.wins).fill(true),...Array(d.losses).fill(false)];
                  return (
                    <div key={d.player+d.team} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 0", borderBottom:i<2?"1px solid #0d1a2e":"none" }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:i===0?"#FFD700":i===1?"#C0C0C0":"#CD7F32", width:20, flexShrink:0, paddingTop:1, textAlign:"right" }}>{i+1}</div>
                      <div style={{ background:`${color}18`, border:`1px solid ${color}50`, borderRadius:4, padding:"2px 6px", fontSize:9, fontWeight:700, color, flexShrink:0, marginTop:1, minWidth:32, textAlign:"center" }}>{d.team}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:C.text }}>{d.player}</div>
                        <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:4 }}>
                          {dots.map((w,j) => <span key={j} style={{ width:7, height:7, borderRadius:"50%", background:w?C.green:C.red, display:"inline-block", flexShrink:0, opacity:0.9 }}/>)}
                        </div>
                      </div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:pctColor, lineHeight:1, flexShrink:0, paddingTop:1 }}>{d.pct}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize:9, color:C.muted, marginTop:8 }}>min 5 picks · all seasons</div>
            </div>

          </div>
        )}

        {activeTab==="prize" && (
          <div>
            <div style={{ display:"flex", gap:0, marginBottom:16, borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
              {[["total","Total Prize"],["wta","WTA All Time"],["wtacalc","WTA 24/25-25/26"],["gg","Goal Guess"],["ss","Sweepstake"],["wroot","Wroot %"]].map(([v,l]) => (
                <button key={v} onClick={()=>setPrizeTab(v)} style={{
                  padding:"9px 12px", cursor:"pointer", fontFamily:"inherit",
                  fontSize:9, letterSpacing:1.2, textTransform:"uppercase", border:"none",
                  background:prizeTab===v?"#0f2050":"transparent",
                  color:prizeTab===v?C.accent:C.muted,
                  borderBottom:`2px solid ${prizeTab===v?C.accent:"transparent"}`,
                  transition:"all .2s", whiteSpace:"nowrap",
                }}>{l}</button>
              ))}
            </div>

            {prizeTab==="total" && (
              <div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>ALL TIME TOTAL PRIZE MONEY</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {[...overallStats].filter(p => p.total > 0).sort((a,b) => b.total - a.total).map((p,i) => (
                    <div key={p.player} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted, width:18, flexShrink:0 }}>{i+1}</span>
                        <span style={{ flex:1, fontWeight:500, color:C.text, fontSize:11 }}>{p.player}</span>
                        <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:10 }}>
                          {p.gg>0 && <span style={{ color:C.muted }}>GG £{p.gg.toFixed(2)}</span>}
                          {p.ss>0 && <span style={{ color:C.muted }}>SS £{p.ss.toFixed(2)}</span>}
                          {p.wta>0 && <span style={{ color:C.muted }}>WTA £{p.wta.toFixed(2)}</span>}
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.green, minWidth:70, textAlign:"right" }}>£{p.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prizeTab==="wta" && (
              <div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>ALL TIME WINNER TAKES ALL</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {[...overallStats].filter(p => p.wta > 0).sort((a,b) => b.wta - a.wta).map((p,i) => (
                    <div key={p.player} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted, width:18, flexShrink:0 }}>{i+1}</span>
                        <span style={{ flex:1, fontWeight:500, color:C.text, fontSize:11 }}>{p.player}</span>
                        <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:10 }}>
                          {p.wtaWins>0 && <span style={{ color:C.green }}>🏆 {p.wtaWins}</span>}
                          {p.wtaSplits>0 && <span style={{ color:C.accent }}>🤝 {p.wtaSplits}</span>}
                          {p.wtaRollovers>0 && <span style={{ color:C.amber }}>🔄 {p.wtaRollovers}</span>}
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.green, minWidth:70, textAlign:"right" }}>£{p.wta.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prizeTab==="wtacalc" && (
              <div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>NET WINNINGS — 24/25 & 25/26 SEASONS</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:22 }}>
                  {prizeData.leaderboard.map((p,i) => (
                    <div key={p.player} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted, width:18, flexShrink:0 }}>{i+1}</span>
                        <span style={{ flex:1, fontWeight:500, color:C.text, fontSize:11 }}>{p.player}</span>
                        <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:10 }}>
                          <span style={{ color:C.green }}>Won £{p.won%1===0?p.won:p.won.toFixed(2)}</span>
                          <span style={{ color:C.muted }}>Spent £{p.spent}</span>
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, minWidth:60, textAlign:"right", color:p.net>0?C.green:p.net<0?C.red:C.muted }}>
                            {p.net>0?"+":""}£{p.net%1===0?p.net:p.net.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>ROUND BY ROUND</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {prizeData.games.map(g => {
                    const isInProgress = g.outcome==="inprogress";
                    const isRollover = g.outcome==="rollover";
                    const outcomeColor = isInProgress?C.amber:isRollover?C.accent:C.green;
                    const outcomeLabel = isInProgress?"🟡 In Progress":isRollover?"🔄 Rollover":g.winners.length===1?`🏆 ${g.winners[0]}`:`🤝 ${g.winners.join(" & ")}`;
                    return (
                      <div key={g.season+g.game} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11, fontWeight:600, color:C.text }}>{g.season==="2024"?"24/25":"25/26"} {g.game.replace("Game","Round")}</div>
                            <div style={{ fontSize:10, color:outcomeColor, marginTop:2 }}>{outcomeLabel}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:isInProgress?C.amber:C.green, lineHeight:1 }}>£{g.totalPot}</div>
                            <div style={{ fontSize:8, color:C.muted, letterSpacing:1, textTransform:"uppercase" }}>{isInProgress?"current pot":isRollover?"rolled over":"prize pot"}</div>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:12, fontSize:10, color:C.muted, flexWrap:"wrap" }}>
                          <span>{g.entrants} x £10 = <strong style={{ color:C.text }}>£{g.gamePot}</strong></span>
                          {g.rolledOver===0&&!isInProgress&&!isRollover&&g.totalPot>g.gamePot&&<span>+ rollover <strong style={{ color:C.text }}>£{g.totalPot-g.gamePot}</strong></span>}
                          {isRollover&&<span style={{ color:C.accent }}>Carries to next round</span>}
                          {!isInProgress&&!isRollover&&g.winners.length>1&&(
                            <span>Each: <strong style={{ color:C.green }}>£{(g.totalPot/g.winners.length)%1===0?g.totalPot/g.winners.length:(g.totalPot/g.winners.length).toFixed(2)}</strong></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {prizeTab==="gg" && (
              <div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>GOAL GUESS — ALL TIME</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {[...overallStats].filter(p => p.gg > 0).sort((a,b) => b.gg - a.gg).map((p,i) => (
                    <div key={p.player} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted, width:18, flexShrink:0 }}>{i+1}</span>
                        <span style={{ flex:1, fontWeight:500, color:C.text, fontSize:11 }}>{p.player}</span>
                        <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:10 }}>
                          <span style={{ color:C.muted }}>🎯 {p.ggWins} {p.ggWins===1?"win":"wins"}</span>
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.green, minWidth:70, textAlign:"right" }}>£{p.gg.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prizeTab==="ss" && (
              <div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>SWEEPSTAKE — ALL TIME</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {[...overallStats].filter(p => p.ss > 0).sort((a,b) => b.ss - a.ss).map((p,i) => (
                    <div key={p.player} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted, width:18, flexShrink:0 }}>{i+1}</span>
                        <span style={{ flex:1, fontWeight:500, color:C.text, fontSize:11 }}>{p.player}</span>
                        <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:10 }}>
                          <span style={{ color:C.muted }}>🎟 {p.ssWins} {p.ssWins===1?"win":"wins"}</span>
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.green, minWidth:70, textAlign:"right" }}>£{p.ss.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prizeTab==="wroot" && (
              <div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginBottom:14 }}>WROOT FAMILY % OF TOTAL PRIZE POT</div>
                {(() => {
                  const grandTotal = overallStats.reduce((a, p) => a + p.total, 0);
                  const wrootPlayers = ["Chris W", "Tom", "Katy"];
                  const wrootTotal = overallStats
                    .filter(p => wrootPlayers.includes(p.player))
                    .reduce((a, p) => a + p.total, 0);
                  const wrootPct = grandTotal > 0 ? Math.round(wrootTotal / grandTotal * 100) : 0;
                  return (
                    <div>
                      <div style={{ ...card({ marginBottom:14, textAlign:"center" }) }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:48, color:C.accent, lineHeight:1 }}>{wrootPct}%</div>
                        <div style={{ fontSize:9, color:C.muted, letterSpacing:1.5, marginTop:4 }}>OF ALL PRIZE MONEY WON BY WROOTS</div>
                        <div style={{ fontSize:10, color:C.muted, marginTop:6 }}>£{wrootTotal.toFixed(2)} of £{grandTotal.toFixed(2)}</div>
                        <div style={{ height:8, background:"#111d30", borderRadius:4, overflow:"hidden", marginTop:10 }}>
                          <div style={{ height:"100%", width:`${wrootPct}%`, background:C.accent, borderRadius:4, transition:"width .5s" }}/>
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        {overallStats
                          .filter(p => wrootPlayers.includes(p.player))
                          .sort((a,b) => b.total - a.total)
                          .map((p,i) => {
                            const pct = grandTotal > 0 ? Math.round(p.total / grandTotal * 100) : 0;
                            return (
                              <div key={p.player} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:i===0?"#FFD700":i===1?"#C0C0C0":"#CD7F32", width:18, flexShrink:0 }}>{i+1}</span>
                                  <span style={{ flex:1, fontWeight:500, color:C.text, fontSize:11 }}>{p.player}</span>
                                  <span style={{ color:C.muted, fontSize:10 }}>£{p.total.toFixed(2)}</span>
                                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.accent, minWidth:50, textAlign:"right" }}>{pct}%</span>
                                </div>
                                <div style={{ height:5, background:"#111d30", borderRadius:3, overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${pct}%`, background:C.accent, borderRadius:3 }}/>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
