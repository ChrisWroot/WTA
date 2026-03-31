import STATIC_DATA from './data.json';
export { STATIC_DATA };

export const GAME_COLS = {
  "2024": {
    "Game 1":  { start: 1,  end: 5  },
    "Game 2":  { start: 6,  end: 10 },
    "Game 3":  { start: 11, end: 13 },
    "Game 4":  { start: 14, end: 17 },
    "Game 5":  { start: 18, end: 24 },
    "Game 6":  { start: 25, end: 35 },
  },
  "2025": {
    "Game 1":  { start: 36, end: 43 },
    "Game 2":  { start: 44, end: 45 },
    "Game 3":  { start: 46, end: 47 },
    "Game 4":  { start: 48, end: 52 },
    "Game 5":  { start: 53, end: 54 },
    "Game 6":  { start: 55, end: 56 },
    "Game 7":  { start: 57, end: 57 },
    "Game 8":  { start: 58, end: 62 },
    "Game 9":  { start: 63, end: 65 },
    "Game 10": { start: 66, end: 75 },
  }
};

export const PLAYERS = ["Ed","Chris W","Franklin","Dan","Patrick","Elliot","Ollie","Chris D","Katy","James","Tom","Jack","Joe","Alex","Emily","Phil","Gareth","Helen","Sam","Keiron"];

export const TEAM_COLORS = {
  ARS:"#EF0107",MCI:"#6CABDD",LIV:"#C8102E",TOT:"#132257",CHE:"#034694",
  MUN:"#DA291C",NEW:"#8B8B8B",AVL:"#670E36",BHA:"#0057B8",BOU:"#B22222",
  WOL:"#FDB913",NFO:"#DD0000",BRE:"#E30613",CRY:"#1B458F",EVE:"#003399",
  FUL:"#CC0000",WHU:"#7A263A",IPS:"#3A64A3",SUN:"#EB172B",
};
export const PRIZE_OUTCOMES = {
  "2024": {
    "Game 1": { result: "split", winners: ["Elliot", "Joe"] },
    "Game 2": { result: "win", winners: ["Katy"] },
    "Game 3": { result: "win", winners: ["Alex"] },
    "Game 4": { result: "split", winners: ["Franklin", "Joe"] },
    "Game 5": { result: "split", winners: ["Ed", "Gareth"] },
    "Game 6": { result: "win", winners: ["Jack"] }
  },
  "2025": {
    "Game 1": { result: "split", winners: ["Ed", "Chris W"] },
    "Game 2": { result: "split", winners: ["Chris W", "Dan"] },
    "Game 3": { result: "rollover", winners: [] },
    "Game 4": { result: "split", winners: ["Chris W", "Tom"] },
    "Game 5": { result: "win", winners: ["Jack"] },
    "Game 6": { result: "win", winners: ["James"] },
    "Game 7": { result: "rollover", winners: [] },
    "Game 8": { result: "split", winners: ["Chris D", "Phil"] },
    "Game 9": { result: "win", winners: ["Franklin"] },
    "Game 10": { result: "inprogress", winners: [] }
  }
};


