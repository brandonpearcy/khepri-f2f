// Pure helpers that turn Army unit profiles + weapons into calculator inputs.
// No React here so the rules can be unit-tested with `node --test`.

export const SKILL = {
  MIMETISM: 28,
  DODGE: 40,
  TOTAL_REACTION: 61,
  SIXTH_SENSE: 67,
  SAPPER: 89,
  NEUROCINETICS: 109,
  MARKSMANSHIP: 156,
  IMMUNITY: 162,
  SURPRISE_ATTACK: 191,
  NO_COVER: 264,
  LIMITED_COVER: 268,
};

export const EQUIP = {
  NANOSCREEN: 108,
  MSV1: 114,
  MSV2: 115,
  MSV3: 116,
  X_VISOR: 117,
  ALBEDO: 183,
};

// Shared distance between the two units. `to` is the upper bound in cm, which
// matches the cumulative band limits in the Army weapon table.
export const RANGE_BANDS = [
  {to: 20, label: '0-8"'},
  {to: 40, label: '8-16"'},
  {to: 60, label: '16-24"'},
  {to: 80, label: '24-32"'},
  {to: 100, label: '32-40"'},
  {to: 120, label: '40-48"'},
  {to: 240, label: '48"+'},
];

// Same limits as src/inputs/validateParams.js
const LIMITS = {
  burstA: [1, 6],
  burstB: [0, 6],
  bonusBurst: [0, 3],
  successValue: [1, 30],
  damage: [0, 30],
  arm: [0, 13],
  bts: [0, 12],
};
const clamp = ([min, max], n) => Math.min(max, Math.max(min, n));

const BS_SAVINGS = new Set(['ARM', 'ARM/2', 'BTS', 'BTS/2', 'ARM=0', 'ARM and BTS']);
const EXCLUDED_PROPS = new Set(['CC', 'CC Attack (+3)', 'Deployable', 'Perimeter', 'Comms. Attack', 'Technical Weapon', 'Targetless']);

export function effectiveTraits(profile, option) {
  return {
    skills: [...(profile?.skills ?? []), ...(option?.skills ?? [])],
    equip: [...(profile?.equip ?? []), ...(option?.equip ?? [])],
  };
}

const hasSkill = (traits, id, extra) =>
  (traits?.skills ?? []).some((s) => s.id === id && (extra === undefined || (s.extra ?? []).includes(extra)));
const hasEquip = (traits, id) => (traits?.equip ?? []).some((e) => e.id === id);
const skillExtra = (traits, id) => (traits?.skills ?? []).find((s) => s.id === id)?.extra?.[0] ?? null;

export const isTemplate = (row) => (row?.props ?? []).some((p) => p.startsWith('Direct Template'));

export const isImpactTemplate = (row) => (row?.props ?? []).some((p) => p.startsWith('Impact Template'));

// Direct and Impact (Blast mode) templates ignore the +3 ARM/BTS from cover
// on the saving roll. The -3 BS MOD still applies to the attack roll.
export const ignoresCoverOnSaves = (row) => isTemplate(row) || isImpactTemplate(row);

// Units with the No Cover skill (TAGs, bikes, Redeye...) get nothing from cover.
export const benefitsFromCover = (side) => Boolean(side?.inCover) && !hasSkill(side?.traits, SKILL.NO_COVER);

// Nanoscreen (wiki): -3 BS MOD on BS Attack Rolls against the user and +3 to
// the user's Saving Rolls against BS Attacks, templates included. Treated as
// the same MOD as cover, so the two do not stack.
export const hasNanoscreen = (side) => hasEquip(side?.traits, EQUIP.NANOSCREEN);

export function isBsAttackWeapon(row) {
  if (!row || typeof row.dmg !== 'number') return false;
  if (!BS_SAVINGS.has(row.saving)) return false;
  if ((row.props ?? []).some((p) => EXCLUDED_PROPS.has(p))) return false;
  return Boolean(row.ranges) || isTemplate(row);
}

// Loadout-level weapon extras such as "+1B", "+1SD", "PS=6", "AP".
export function parseWeaponMods(extra = []) {
  const mods = {burst: 0, sd: 0, ps: null, forceAP: false, cont: false, sv: 0};
  for (const e of extra ?? []) {
    let m;
    if ((m = /^\+(\d+)B$/.exec(e))) mods.burst += Number(m[1]);
    else if ((m = /^\+(\d+)SD$/.exec(e))) mods.sd += Number(m[1]);
    else if ((m = /^PS=(\d+)$/.exec(e))) mods.ps = Number(m[1]);
    else if (e === 'AP') mods.forceAP = true;
    else if (e === 'Continous Damage') mods.cont = true;
    else if ((m = /^([+-]\d+)$/.exec(e))) mods.sv += Number(m[1]);
  }
  return mods;
}

const modeSuffix = (mode) => (mode ? ` (${mode.replace(/ Mode$/i, '')})` : '');

export function weaponLabel(row, mods) {
  const burst = isTemplate(row) ? 'T' : (row.burst ?? 1) + mods.burst;
  const sd = mods.sd > 0 ? `+${mods.sd}SD` : '';
  const dmg = mods.ps ?? row.dmg;
  return `${row.name}${modeSuffix(row.mode)} · B${burst}${sd} · PS${dmg} · ${row.ammo ?? 'N'}`;
}

// Single-mode first, then "Hit Mode", so the default pick is the plain shot.
const modeRank = (row) => (!row.mode ? 0 : /^hit/i.test(row.mode) ? 1 : 2);

// BS-attack capable weapons of a loadout, one entry per firing mode.
export function bsWeapons(option, weapons) {
  const out = [];
  for (const w of option?.weapons ?? []) {
    const mods = parseWeaponMods(w.extra);
    const rows = [...(weapons?.[w.id] ?? [])].sort((a, b) => modeRank(a) - modeRank(b));
    for (const row of rows) {
      if (!isBsAttackWeapon(row)) continue;
      const key = `${w.id}:${row.mode ?? ''}`;
      if (out.some((x) => x.key === key)) continue;
      out.push({key, id: w.id, name: row.name, mode: row.mode, row, mods, label: weaponLabel(row, mods)});
    }
  }
  return out;
}

export function dodgeSuccessValue(profile, traits) {
  let sv = profile?.ph ?? 0;
  const extra = skillExtra(traits, SKILL.DODGE);
  let m;
  if (extra && (m = /^PH=(\d+)$/.exec(extra))) sv = Number(m[1]);
  else if (extra && (m = /^([+-]\d+)$/.exec(extra))) sv += Number(m[1]);
  return clamp(LIMITS.successValue, sv);
}

// Reactive-only choices that are not weapons.
// Dodge is valid for both sides; "No ARO" only makes sense for the reactive one.
export function pseudoWeapons(profile, traits, side = 'B') {
  const list = [{key: 'dodge', pseudo: 'dodge', label: `Dodge (PH ${dodgeSuccessValue(profile, traits)})`}];
  if (side === 'B') list.push({key: 'none', pseudo: 'none', label: 'No ARO (unopposed)'});
  return list;
}

// BS MOD of a weapon at the chosen distance; null when out of range.
export function rangeModFor(row, distanceCm) {
  if (isTemplate(row)) return 0;
  if (!row?.ranges) return null;
  const band = row.ranges.find((b) => distanceCm <= b.to);
  return band ? band.mod : null;
}

function bsWeaponNames(option, weapons) {
  const names = [];
  for (const w of option?.weapons ?? []) {
    if ((weapons?.[w.id] ?? []).some(isBsAttackWeapon) && !names.includes(w.name)) names.push(w.name);
  }
  return names;
}

// Distinguishable labels for the loadout rows of a profile group (the Army
// app lists e.g. six identically named "HATAMOTO" rows).
export function loadoutLabels(group, weapons) {
  const options = group?.options ?? [];
  const namesDiffer = new Set(options.map((o) => o.name)).size > 1;
  const perOption = options.map((o) => bsWeaponNames(o, weapons));
  const labels = options.map((o, i) => {
    const mine = perOption[i];
    const common = mine.filter((n) => perOption.every((names) => names.includes(n)));
    let shown = mine.filter((n) => !common.includes(n));
    if (shown.length === 0) shown = mine;
    const extras = [...(o.skills ?? []), ...(o.equip ?? [])].map((x) =>
      x.extra?.length ? `${x.name} (${x.extra.join(', ')})` : x.name);
    const parts = [];
    if (namesDiffer && o.name) parts.push(o.name);
    if (shown.length > 0) parts.push(shown.join(', '));
    if (extras.length > 0) parts.push(extras.join(', '));
    parts.push(`${o.points} pts / ${o.swc} SWC`);
    return {id: o.id, label: parts.join(' · ')};
  });
  const counts = labels.reduce((acc, l) => acc.set(l.label, (acc.get(l.label) ?? 0) + 1), new Map());
  return labels.map((l) => (counts.get(l.label) > 1 ? {...l, label: `${l.label} #${l.id}`} : l));
}

// Resolves a picker selection (ids) against the army data.
export function resolveSelection(army, sel) {
  if (!army || !sel?.unitId) return null;
  const unit = army.units.find((u) => u.id === sel.unitId);
  if (!unit) return null;
  const factionId = sel.factionId ?? (unit.inFactions.length === 1 ? unit.inFactions[0] : null);
  const groups = factionId ? unit.byFaction[factionId]?.groups ?? null : null;
  const group = groups?.find((g) => g.id === sel.groupId) ?? (groups?.length === 1 ? groups[0] : null);
  const profile = group?.profiles.find((p) => p.id === sel.profileId) ?? (group?.profiles.length === 1 ? group.profiles[0] : null);
  const option = group?.options.find((o) => o.id === sel.optionId) ?? null;
  const traits = profile ? effectiveTraits(profile, option) : null;
  let weapon = null;
  if (option && profile && sel.weaponKey) {
    weapon = bsWeapons(option, army.weapons).find((w) => w.key === sel.weaponKey)
      ?? pseudoWeapons(profile, traits, 'B').find((w) => w.key === sel.weaponKey)
      ?? null;
  }
  return {unit, factionId, groups, group, profile, option, traits, weapon, inCover: Boolean(sel.inCover)};
}

const equipExtra = (traits, id) => (traits?.equip ?? []).find((e) => e.id === id)?.extra?.[0] ?? null;
const hasMsv = (traits) => hasEquip(traits, EQUIP.MSV1) || hasEquip(traits, EQUIP.MSV2) || hasEquip(traits, EQUIP.MSV3);

// Albedo (wiki): an enemy with a Multispectral Visor or Marksmanship who
// declares a BS Attack requiring LoF against the bearer applies the bracketed
// MOD (-3 / -6). Not applied to CC. Other attackers are unaffected.
function albedoMod(targetTraits, attackerTraits) {
  if (!hasEquip(targetTraits, EQUIP.ALBEDO)) return 0;
  if (!hasMsv(attackerTraits) && !hasSkill(attackerTraits, SKILL.MARKSMANSHIP)) return 0;
  const mod = Number(equipExtra(targetTraits, EQUIP.ALBEDO));
  return Number.isFinite(mod) && mod < 0 ? mod : -3;
}

function mimetismMod(targetTraits, attackerTraits) {
  const extra = skillExtra(targetTraits, SKILL.MIMETISM);
  if (!hasSkill(targetTraits, SKILL.MIMETISM)) return 0;
  const mod = Number(extra);
  const value = Number.isFinite(mod) && mod < 0 ? mod : -3;
  if (hasEquip(attackerTraits, EQUIP.MSV2) || hasEquip(attackerTraits, EQUIP.MSV3)) return 0;
  if (hasEquip(attackerTraits, EQUIP.MSV1) && value === -3) return 0;
  return value;
}

// Viral etc. are listed as one BTS save plus a "Bioweapon (DA+SHOCK)" property.
const bioweaponAmmo = (row) => {
  const prop = (row.props ?? []).find((p) => p.startsWith('Bioweapon ('));
  if (!prop) return null;
  if (/\bEXP\b/i.test(prop)) return 'EXP';
  if (/\bDA\b/i.test(prop)) return 'DA';
  return null;
};

export function calcAmmo(row, targetTraits) {
  if (row.saves === '1 and 1') return 'PLASMA';
  if (hasSkill(targetTraits, SKILL.IMMUNITY, 'Enhanced')) return 'N';
  if (row.saves === '2') return 'DA';
  if (row.saves === '3') return 'EXP';
  const bio = bioweaponAmmo(row);
  if (bio) return bio;
  if (['T2', 'AP+T2'].includes(row.ammo)) return 'T2';
  return 'N';
}

const IGNORED = [
  ['skill', SKILL.LIMITED_COVER, 'Limited Cover'],
  ['skill', SKILL.SAPPER, 'Sapper'],
  ['skill', SKILL.SURPRISE_ATTACK, 'Surprise Attack'],
  ['skill', SKILL.MARKSMANSHIP, 'Marksmanship'],
  ['skill', SKILL.SIXTH_SENSE, 'Sixth Sense'],
];

// Names of traits on this side that the converter does not model yet.
function unsupportedTraits(side) {
  if (!side?.traits) return [];
  const found = IGNORED
    .filter(([kind, id]) => (kind === 'skill' ? hasSkill(side.traits, id) : hasEquip(side.traits, id)))
    .map(([, , name]) => name);
  for (const extra of ['ARM', 'Shock']) {
    if (hasSkill(side.traits, SKILL.IMMUNITY, extra)) found.push(`Immunity (${extra})`);
  }
  return found;
}

function approximationNotes(label, side) {
  const notes = [];
  if (side?.weapon?.row && (side.weapon.row.props ?? []).includes('Non-lethal')) {
    notes.push(`Warning: ${label} ${side.weapon.row.name} is non-lethal; results shown as wounds`);
  }
  return notes;
}

function attackInputs(x, y, rangeCm, side, errors, notes) {
  const label = side === 'A' ? 'Active' : 'Reactive';
  const {row, mods} = x.weapon;
  let rangeMod = rangeModFor(row, rangeCm);
  if (rangeMod === null) {
    errors.push(`${label}: ${row.name} is out of range at this distance`);
    rangeMod = row.ranges?.[row.ranges.length - 1]?.mod ?? 0;
  }
  if (rangeMod === -6 && hasEquip(x.traits, EQUIP.X_VISOR)) rangeMod = -3;
  const mim = y ? mimetismMod(y.traits, x.traits) : 0;
  const albedo = y ? albedoMod(y.traits, x.traits) : 0;
  const cover = benefitsFromCover(y) || hasNanoscreen(y) ? -3 : 0;
  const sv = clamp(LIMITS.successValue, x.profile.bs + rangeMod + mim + albedo + cover + mods.sv);

  let burst = isTemplate(row) ? 1 : (row.burst ?? 1) + mods.burst;
  if (side === 'B' && !hasSkill(x.traits, SKILL.TOTAL_REACTION) && !hasSkill(x.traits, SKILL.NEUROCINETICS)) {
    burst = 1;
  }
  const out = {
    [`successValue${side}`]: sv,
    [`burst${side}`]: clamp(side === 'A' ? LIMITS.burstA : LIMITS.burstB, burst),
    [`bonusBurst${side}`]: clamp(LIMITS.bonusBurst, mods.sd),
    [`damage${side}`]: clamp(LIMITS.damage, mods.ps ?? row.dmg),
    [`ammo${side}`]: calcAmmo(row, y?.traits),
    [`cont${side}`]: mods.cont || (row.props ?? []).includes('Continous Damage'),
  };
  if (hasSkill(y?.traits, SKILL.IMMUNITY, 'Enhanced') && row.saves !== '1 and 1' && row.saves !== '1') {
    notes.push(`${label}: target has Immunity (Enhanced); special ammo treated as N`);
  }
  return out;
}

function defenseInputs(y, incoming, side) {
  const p = y.profile;
  const saving = incoming?.row?.saving ?? 'ARM';
  let base = saving.startsWith('BTS') ? p.bts : saving === 'ARM=0' ? 0 : p.arm;
  base = Math.max(0, base ?? 0);
  const halve = saving.endsWith('/2') || Boolean(incoming?.mods?.forceAP);
  const apImmune = hasSkill(y.traits, SKILL.IMMUNITY, 'AP') || hasSkill(y.traits, SKILL.IMMUNITY, 'Enhanced');
  if (halve && !apImmune) base = Math.ceil(base / 2);
  const templateIncoming = ignoresCoverOnSaves(incoming?.row);
  const coverSave = benefitsFromCover(y) && !templateIncoming ? 3 : 0;
  const nanoSave = hasNanoscreen(y) ? 3 : 0;
  const cover = Math.max(coverSave, nanoSave);
  return {
    [`arm${side}`]: clamp(LIMITS.arm, base + cover),
    [`bts${side}`]: clamp(LIMITS.bts, Math.max(0, p.bts ?? 0) + cover),
    [`critImmune${side}`]: hasSkill(y.traits, SKILL.IMMUNITY, 'Critical'),
  };
}

const MODELED_SKILLS = [SKILL.MIMETISM, SKILL.NO_COVER, SKILL.TOTAL_REACTION, SKILL.NEUROCINETICS];
const MODELED_EQUIP = [EQUIP.NANOSCREEN, EQUIP.MSV1, EQUIP.MSV2, EQUIP.MSV3, EQUIP.X_VISOR, EQUIP.ALBEDO];
const MODELED_IMMUNITIES = ['AP', 'Critical', 'Enhanced'];
const traitLabel = (t) => (t.extra?.length ? `${t.name} (${t.extra.join(', ')})` : t.name);

// Skills, equipment and state on this side that the converter actually uses,
// for the matchup summary. Order follows the profile.
export function matchupTraits(side) {
  if (!side?.traits) return [];
  const out = [];
  for (const s of side.traits.skills) {
    if (MODELED_SKILLS.includes(s.id)) out.push(traitLabel(s));
    else if (s.id === SKILL.IMMUNITY && (s.extra ?? []).some((e) => MODELED_IMMUNITIES.includes(e))) out.push(traitLabel(s));
    else if (s.id === SKILL.DODGE && side.weapon?.pseudo === 'dodge') out.push(traitLabel(s));
  }
  for (const e of side.traits.equip) {
    if (MODELED_EQUIP.includes(e.id)) out.push(traitLabel(e));
  }
  if (benefitsFromCover(side)) out.push('In cover');
  return [...new Set(out)];
}

// Builds the partial calculator input object for both sides.
// `active` / `reactive` are results of resolveSelection() (or null).
export function deriveInputs({active, reactive, rangeCm}) {
  const inputs = {};
  const errors = [];
  const notes = [];
  const a = active?.profile ? active : null;
  const b = reactive?.profile ? reactive : null;
  const aTemplate = Boolean(a?.weapon?.row && isTemplate(a.weapon.row));

  const bTemplate = Boolean(b?.weapon?.row && isTemplate(b.weapon.row));

  if (a) {
    if (!a.weapon) {
      errors.push('Active: choose a weapon or Dodge');
    } else if (a.weapon.pseudo === 'dodge') {
      // The calculator only models templates against a dodging *reactive* trooper.
      if (bTemplate) errors.push('Active Dodge against a reactive template weapon is not supported');
      inputs.ammoA = 'DODGE';
      inputs.burstA = 1;
      inputs.bonusBurstA = 0;
      inputs.successValueA = dodgeSuccessValue(a.profile, a.traits);
      inputs.contA = false;
      inputs.dtwVsDodge = false;
    } else if (a.weapon.pseudo) {
      errors.push('Active: choose a BS weapon or Dodge');
    } else if ((a.profile.bs ?? 0) <= 0) {
      errors.push('Active: this profile cannot make BS attacks; pick Dodge');
    } else {
      Object.assign(inputs, attackInputs(a, b, rangeCm, 'A', errors, notes));
      inputs.dtwVsDodge = aTemplate;
    }
    if (b?.weapon?.row) Object.assign(inputs, defenseInputs(a, b.weapon, 'A'));
    else if (b) Object.assign(inputs, defenseInputs(a, null, 'A'));
  }

  if (b) {
    if (!b.weapon) {
      errors.push('Reactive: choose a weapon, Dodge or No ARO');
    } else if (aTemplate || b.weapon.pseudo === 'dodge') {
      if (aTemplate && !b.weapon.pseudo) notes.push('Reactive: template weapon forces a Dodge');
      inputs.ammoB = 'DODGE';
      inputs.burstB = 1;
      inputs.bonusBurstB = 0;
      inputs.successValueB = dodgeSuccessValue(b.profile, b.traits);
      inputs.contB = false;
    } else if (b.weapon.pseudo === 'none') {
      inputs.burstB = 0;
      inputs.bonusBurstB = 0;
    } else if ((b.profile.bs ?? 0) <= 0) {
      errors.push('Reactive: this profile cannot make BS attacks; pick Dodge or No ARO');
    } else {
      Object.assign(inputs, attackInputs(b, a, rangeCm, 'B', errors, notes));
    }
    if (a?.weapon?.row) Object.assign(inputs, defenseInputs(b, a.weapon, 'B'));
    else if (a) Object.assign(inputs, defenseInputs(b, null, 'B'));
  }

  if (a || b) inputs.fixedFaceToFace = false;
  const unsupported = [...new Set([...unsupportedTraits(a), ...unsupportedTraits(b)])];
  if (unsupported.length > 0) notes.push(`Warning: support for ${unsupported.join(', ')} not implemented yet`);
  notes.push(...approximationNotes('active', a), ...approximationNotes('reactive', b));

  return {inputs, ok: errors.length === 0 && (a !== null || b !== null), errors, notes};
}
