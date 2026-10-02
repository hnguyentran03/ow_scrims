export type Role = "Tank" | "Damage" | "Support" | "Unknown";

export const ROLE_ORDER: Role[] = ["Tank", "Damage", "Support", "Unknown"];

// The full roster as of September 2026 (53 heroes), checked against the Overwatch wiki on 2026-09-29.
// Add new heroes here; unknown names fall back to "Unknown" and never break the page.
const HERO_ROLES: Record<string, Role> = {
  "D.Mon": "Tank", "D.Va": "Tank", Doomfist: "Tank", Domina: "Tank", Hazard: "Tank", "Junker Queen": "Tank", Mauga: "Tank",
  Orisa: "Tank", Ramattra: "Tank", Reinhardt: "Tank", Roadhog: "Tank", Sigma: "Tank", Winston: "Tank",
  "Wrecking Ball": "Tank", Zarya: "Tank",
  Anran: "Damage", Ashe: "Damage", Bastion: "Damage", Cassidy: "Damage", Echo: "Damage", Emre: "Damage", Freja: "Damage",
  Genji: "Damage", Hanzo: "Damage", Junkrat: "Damage", Mei: "Damage", Pharah: "Damage", Reaper: "Damage",
  Shion: "Damage", Sierra: "Damage", Sojourn: "Damage", "Soldier: 76": "Damage", Sombra: "Damage", Symmetra: "Damage",
  Torbjörn: "Damage", Tracer: "Damage", Vendetta: "Damage", Venture: "Damage", Widowmaker: "Damage",
  Ana: "Support", Baptiste: "Support", Brigitte: "Support", Illari: "Support", "Jetpack Cat": "Support", Juno: "Support",
  Kiriko: "Support", Lifeweaver: "Support", Lúcio: "Support", Mercy: "Support", Mizuki: "Support", Moira: "Support",
  Wuyang: "Support", Zenyatta: "Support",
};

const BY_LOWER = new Map(Object.keys(HERO_ROLES).map((h) => [h.toLowerCase(), h]));

/** The known spelling of a hero name whatever its case ("d.va" and "D.VA" are "D.Va"); an unknown name passes through trimmed. */
export function canonicalHero(name: string): string {
  const trimmed = name.trim();
  return BY_LOWER.get(trimmed.toLowerCase()) ?? trimmed;
}

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
 * than one row (Moira slot 2 repeats within 1.03 s), so counts are approximate. Every hero in
 * HERO_ROLES has an entry; the ones outside the sample were checked against the default Overwatch
 * bindings on the Overwatch wiki on 2026-09-29. A hero missing here, or the censored hero "0",
 * falls back to "Ability <slot>".
 */
export const HERO_ABILITIES: Readonly<Record<string, readonly [string, string]>> = {
  "D.Mon": ["Propulsors", "Fusion Repeater"], "D.Va": ["Boosters", "Micro Missiles"], Doomfist: ["Seismic Slam", "Power Block"],
  Domina: ["Sonic Repulsors", "Crystal Charge"], Hazard: ["Violent Leap", "Jagged Wall"],
  "Junker Queen": ["Commanding Shout", "Carnage"], Mauga: ["Overrun", "Cardiac Overdrive"], Orisa: ["Fortify", "Javelin Spin"],
  Ramattra: ["Nemesis Form", "Ravenous Vortex"], Reinhardt: ["Charge", "Fire Strike"], Roadhog: ["Chain Hook", "Pig Pen"],
  Sigma: ["Kinetic Grasp", "Accretion"], Winston: ["Jump Pack", "Barrier Projector"], "Wrecking Ball": ["Roll", "Adaptive Shield"],
  Zarya: ["Particle Barrier", "Projected Barrier"],
  Anran: ["Inferno Rush", "Dancing Blaze"], Ashe: ["Coach Gun", "Dynamite"], Bastion: ["Reconfigure", "A-36 Tactical Grenade"], Cassidy: ["Combat Roll", "Magnetic Grenade"],
  Echo: ["Flight", "Focusing Beam"], Emre: ["Siphon Blaster", "Cyber Frag"], Freja: ["Quick Dash", "Updraft"],
  Genji: ["Swift Strike", "Deflect"], Hanzo: ["Sonic Arrow", "Storm Arrows"], Junkrat: ["Concussion Mine", "Steel Trap"],
  Mei: ["Cryo-Freeze", "Ice Wall"], Pharah: ["Jump Jet", "Concussive Blast"], Reaper: ["Wraith Form", "Shadow Step"],
  Shion: ["Evade", "Joyride"], Sierra: ["Anchor Drone", "Tremor Charge"], Sojourn: ["Power Slide", "Disruptor Shot"],
  "Soldier: 76": ["Sprint", "Biotic Field"], Sombra: ["Translocator", "Virus"], Symmetra: ["Sentry Turret", "Teleporter"],
  Torbjörn: ["Overload", "Deploy Turret"], Tracer: ["Blink", "Recall"], Vendetta: ["Whirlwind Dash", "Soaring Slice"],
  Venture: ["Burrow", "Drill Dash"], Widowmaker: ["Grappling Hook", "Venom Mine"],
  Ana: ["Sleep Dart", "Biotic Grenade"], Baptiste: ["Regenerative Burst", "Immortality Field"], Brigitte: ["Whip Shot", "Repair Pack"],
  Illari: ["Outburst", "Healing Pylon"], "Jetpack Cat": ["Lifeline", "Purr"], Juno: ["Glide Boost", "Hyper Ring"],
  Kiriko: ["Swift Step", "Protection Suzu"], Lifeweaver: ["Petal Platform", "Life Grip"], Lúcio: ["Crossfade", "Amp It Up"],
  Mercy: ["Guardian Angel", "Resurrect"], Mizuki: ["Katashiro Return", "Binding Chain"], Moira: ["Fade", "Biotic Orb"],
  Wuyang: ["Rushing Torrent", "Guardian Wave"], Zenyatta: ["Orb of Harmony", "Orb of Discord"],
};

/** The named ability for a hero and Workshop slot, or "Ability <slot>" when the hero is unnamed or censored ("0"). */
export function abilityName(hero: string, slot: 1 | 2): string {
  return HERO_ABILITIES[hero]?.[slot - 1] ?? `Ability ${slot}`;
}
