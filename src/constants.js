import STATIC_DATA from './data.json';
export { STATIC_DATA };

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
    "Game 10": { result: "rollover", winners: [] }
    "Game 11": { result: "inprogress", winners: [] },
  }
};


