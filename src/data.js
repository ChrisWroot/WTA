const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const SHEET_NAME = "Main";

export async function fetchSheetData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch sheet data");
  const json = await res.json();
  return json.values;
}
