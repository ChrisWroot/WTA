export default async function handler(req, res) {
  const { type } = req.query;
  
  let url;
  if (type === "all") {
    url = "https://api.football-data.org/v4/competitions/PL/matches?season=2024";
  } else {
    url = "https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED&status=IN_PLAY&status=PAUSED&limit=20";
  }

  const response = await fetch(url, {
    headers: { "X-Auth-Token": process.env.VITE_FOOTBALL_API_KEY }
  });
  const data = await response.json();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}
