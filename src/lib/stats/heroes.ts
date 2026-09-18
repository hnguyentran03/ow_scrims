export type Role = "Tank" | "Damage" | "Support" | "Unknown";

export const ROLE_ORDER: Role[] = ["Tank", "Damage", "Support", "Unknown"];

// Domina, Emre, and Sierra were inferred from swap patterns in the 2026 sample logs.
// Add new heroes here; unknown names fall back to "Unknown" and never break the page.
const HERO_ROLES: Record<string, Role> = {
  "D.Va": "Tank", Doomfist: "Tank", Domina: "Tank", Hazard: "Tank", "Junker Queen": "Tank", Mauga: "Tank",
  Orisa: "Tank", Ramattra: "Tank", Reinhardt: "Tank", Roadhog: "Tank", Sigma: "Tank", Winston: "Tank",
  "Wrecking Ball": "Tank", Zarya: "Tank",
  Ashe: "Damage", Bastion: "Damage", Cassidy: "Damage", Echo: "Damage", Emre: "Damage", Freja: "Damage",
  Genji: "Damage", Hanzo: "Damage", Junkrat: "Damage", Mei: "Damage", Pharah: "Damage", Reaper: "Damage",
  Sierra: "Damage", Sojourn: "Damage", "Soldier: 76": "Damage", Sombra: "Damage", Symmetra: "Damage",
  Torbjörn: "Damage", Tracer: "Damage", Venture: "Damage", Widowmaker: "Damage",
  Ana: "Support", Baptiste: "Support", Brigitte: "Support", Illari: "Support", Juno: "Support", Kiriko: "Support",
  Lifeweaver: "Support", Lúcio: "Support", Mercy: "Support", Moira: "Support", Wuyang: "Support", Zenyatta: "Support",
};

export function roleOf(hero: string): Role {
  return HERO_ROLES[hero] ?? "Unknown";
}
