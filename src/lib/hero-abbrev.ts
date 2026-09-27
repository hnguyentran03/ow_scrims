/** Two-character marker labels. Only heroes whose first two letters collide need an entry. */
const OVERRIDES: Record<string, string> = {
  Ana: "AN", Ashe: "AS",
  Baptiste: "BP", Bastion: "BA", Brigitte: "BR",
  "D.Va": "DV", Doomfist: "DF", Domina: "DM",
  Echo: "EC", Emre: "EM",
  Hanzo: "HZ", Hazard: "HD",
  Junkrat: "JR", "Junker Queen": "JQ", Juno: "JN",
  Lúcio: "LU", Lifeweaver: "LW",
  Mauga: "MG", Mei: "ME", Mercy: "MC", Moira: "MO",
  Ramattra: "RM", Reaper: "RP", Reinhardt: "RH", Roadhog: "RD",
  Sigma: "SG", Sierra: "SR", Sojourn: "SJ", "Soldier: 76": "76", Sombra: "SB", Symmetra: "SY",
  Torbjörn: "TB", Tracer: "TR",
  Vendetta: "VD", Venture: "VT",
  Widowmaker: "WM", Winston: "WN", "Wrecking Ball": "WB", Wuyang: "WY",
  Zarya: "ZA", Zenyatta: "ZN",
};

export function heroAbbrev(hero: string): string {
  if (!hero) return "??";
  return OVERRIDES[hero] ?? hero.slice(0, 2).toUpperCase();
}
