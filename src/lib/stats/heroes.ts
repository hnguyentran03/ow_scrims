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

/** Every known hero, ordered by role then name. The bans editor's option list and the validation set for bans. */
export const HEROES: readonly string[] = Object.keys(HERO_ROLES).sort(
  (a, b) => ROLE_ORDER.indexOf(HERO_ROLES[a]) - ROLE_ORDER.indexOf(HERO_ROLES[b]) || a.localeCompare(b),
);

/**
 * Ability names per Workshop slot: [Ability 1, Ability 2]. The ScrimTime log carries only the slot
 * number. Checked against test/samples/Log-2026-04-02-17-21-48.txt on 2026-09-27: Tracer's slot 1
 * repeats within 0.24 s (Blink charges) and Kiriko's slot 1 never repeats within 7 s (Swift Step's
 * cooldown), so slot 1 is the Shift ability and slot 2 is the E ability. A single use can log more
 * than one row (Moira slot 2 repeats within 1.03 s), so counts are approximate. Heroes whose default
 * binding is not known here (Wrecking Ball, Hanzo, Pharah, Lifeweaver, Freja, the inferred heroes
 * Domina, Emre, Sierra, and Wuyang) are left out on purpose and fall back to "Ability <slot>".
 */
export const HERO_ABILITIES: Readonly<Record<string, readonly [string, string]>> = {
  "D.Va": ["Boosters", "Micro Missiles"], Doomfist: ["Seismic Slam", "Power Block"], Hazard: ["Violent Leap", "Jagged Wall"],
  "Junker Queen": ["Carnage", "Commanding Shout"], Mauga: ["Overrun", "Cardiac Overdrive"], Orisa: ["Fortify", "Javelin Spin"],
  Ramattra: ["Nemesis Form", "Ravenous Vortex"], Reinhardt: ["Charge", "Fire Strike"], Roadhog: ["Chain Hook", "Pig Pen"],
  Sigma: ["Kinetic Grasp", "Accretion"], Winston: ["Jump Pack", "Barrier Projector"], Zarya: ["Particle Barrier", "Projected Barrier"],
  Ashe: ["Coach Gun", "Dynamite"], Bastion: ["Reconfigure", "A-36 Tactical Grenade"], Cassidy: ["Combat Roll", "Magnetic Grenade"],
  Echo: ["Flight", "Focusing Beam"], Genji: ["Swift Strike", "Deflect"], Junkrat: ["Concussion Mine", "Steel Trap"],
  Mei: ["Cryo-Freeze", "Ice Wall"], Reaper: ["Wraith Form", "Shadow Step"], Sojourn: ["Power Slide", "Disruptor Shot"],
  "Soldier: 76": ["Sprint", "Biotic Field"], Sombra: ["Translocator", "Virus"], Symmetra: ["Sentry Turret", "Teleporter"],
  Torbjörn: ["Overload", "Deploy Turret"], Tracer: ["Blink", "Recall"], Venture: ["Burrow", "Drill Dash"],
  Widowmaker: ["Grappling Hook", "Venom Mine"],
  Ana: ["Sleep Dart", "Biotic Grenade"], Baptiste: ["Regenerative Burst", "Immortality Field"], Brigitte: ["Whip Shot", "Repair Pack"],
  Illari: ["Outburst", "Healing Pylon"], Juno: ["Glide Boost", "Hyper Ring"], Kiriko: ["Swift Step", "Protection Suzu"],
  Lúcio: ["Crossfade", "Amp It Up"], Mercy: ["Guardian Angel", "Resurrect"], Moira: ["Fade", "Biotic Orb"],
  Zenyatta: ["Orb of Harmony", "Orb of Discord"],
};

/** The named ability for a hero and Workshop slot, or "Ability <slot>" when the hero is unnamed or censored ("0"). */
export function abilityName(hero: string, slot: 1 | 2): string {
  return HERO_ABILITIES[hero]?.[slot - 1] ?? `Ability ${slot}`;
}
