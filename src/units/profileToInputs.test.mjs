// Run with: yarn test:units   (node --test, no extra dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  bsWeapons,
  deriveInputs,
  effectiveTraits,
  isBsAttackWeapon,
  loadoutLabels,
  matchupTraits,
  pseudoWeapons,
  rangeModFor,
  resolveSelection,
} from './profileToInputs.js';

const RIFLE_RANGES = [{to: 40, mod: 3}, {to: 80, mod: -3}, {to: 120, mod: -6}];
const W = {
  1: [{name: 'Combi Rifle', mode: null, ammo: 'N', burst: 3, dmg: 7, saving: 'ARM', saves: '1', props: ['Suppressive Fire'], ranges: RIFLE_RANGES}],
  2: [
    {name: 'MULTI Rifle', mode: 'AP Mode', ammo: 'AP', burst: 3, dmg: 7, saving: 'ARM/2', saves: '1', props: [], ranges: RIFLE_RANGES},
    {name: 'MULTI Rifle', mode: 'Shock Mode', ammo: 'Shock', burst: 3, dmg: 7, saving: 'ARM', saves: '1', props: [], ranges: RIFLE_RANGES},
  ],
  3: [{name: 'Heavy Flamethrower', mode: null, ammo: 'Fire', burst: 1, dmg: 6, saving: 'ARM', saves: '1', props: ['Direct Template (Large Teardrop)', 'Continous Damage'], ranges: null}],
  4: [{name: 'Viral Combi Rifle', mode: null, ammo: 'N', burst: 3, dmg: 7, saving: 'BTS', saves: '1', props: ['Bioweapon (DA+SHOCK)', 'Suppressive Fire'], ranges: RIFLE_RANGES}],
  5: [{name: 'Plasma Carbine', mode: 'Hit Mode', ammo: 'N', burst: 2, dmg: 6, saving: 'ARM and BTS', saves: '1 and 1', props: [], ranges: RIFLE_RANGES}],
  6: [{name: 'Heavy Pistol', mode: null, ammo: 'Shock', burst: 2, dmg: 6, saving: 'ARM', saves: '1', props: [], ranges: [{to: 20, mod: 3}, {to: 40, mod: 0}, {to: 60, mod: -6}]}],
  7: [{name: 'Heavy Machine Gun', mode: null, ammo: 'N', burst: 4, dmg: 5, saving: 'ARM', saves: '1', props: [], ranges: [{to: 20, mod: -3}, {to: 40, mod: 0}, {to: 80, mod: 3}, {to: 120, mod: -3}]}],
  8: [{name: 'CC Weapon', mode: null, ammo: 'N', burst: null, dmg: 7, saving: 'ARM', saves: '1', props: ['CC'], ranges: null}],
  9: [{name: 'Missile Launcher', mode: 'Hit Mode', ammo: 'Exp', burst: 1, dmg: 6, saving: 'ARM', saves: '3', props: [], ranges: RIFLE_RANGES}],
  10: [{name: 'T2 Rifle', mode: null, ammo: 'T2', burst: 3, dmg: 6, saving: 'ARM', saves: '1', props: [], ranges: RIFLE_RANGES}],
  11: [
    {name: 'Plasma Carbine', mode: 'Hit Mode', ammo: 'N', burst: 2, dmg: 6, saving: 'ARM and BTS', saves: '1 and 1', props: [], ranges: RIFLE_RANGES},
    {name: 'Plasma Carbine', mode: 'Blast Mode', ammo: 'N', burst: 2, dmg: 7, saving: 'ARM and BTS', saves: '1 and 1', props: ['Impact Template (Circular)'], ranges: RIFLE_RANGES},
  ],
};

const profile = (over = {}) => ({id: 1, name: 'P', bs: 12, ph: 12, arm: 2, bts: 3, w: 1, skills: [], equip: [], ...over});
const option = (weapons, over = {}) => ({id: 1, name: 'O', points: 10, swc: '0', weapons, skills: [], equip: [], ...over});
const side = (p, o, weaponKey, inCover = false) => {
  const traits = effectiveTraits(p, o);
  const weapon = bsWeapons(o, W).find((w) => w.key === weaponKey) ?? pseudoWeapons(p, traits).find((w) => w.key === weaponKey) ?? null;
  return {profile: p, option: o, traits, weapon, inCover};
};
const combi = option([{id: 1, name: 'Combi Rifle'}, {id: 8, name: 'CC Weapon'}]);

test('bsWeapons expands modes and drops CC weapons', () => {
  const o = option([{id: 2, name: 'MULTI Rifle'}, {id: 3, name: 'Heavy Flamethrower'}, {id: 8, name: 'CC Weapon'}]);
  const keys = bsWeapons(o, W).map((w) => w.key);
  assert.deepEqual(keys, ['2:AP Mode', '2:Shock Mode', '3:']);
  assert.equal(isBsAttackWeapon(W[8][0]), false);
});

test('rangeModFor uses the shared distance band', () => {
  assert.equal(rangeModFor(W[1][0], 40), 3);
  assert.equal(rangeModFor(W[1][0], 60), -3);
  assert.equal(rangeModFor(W[6][0], 120), null);
  assert.equal(rangeModFor(W[3][0], 120), 0);
});

test('combi vs combi at 8-16", reactive in cover', () => {
  const r = deriveInputs({active: side(profile({bs: 13}), combi, '1:'), reactive: side(profile(), combi, '1:', true), rangeCm: 40});
  assert.equal(r.ok, true);
  assert.equal(r.inputs.successValueA, 13);   // 13 + 3 range - 3 cover
  assert.equal(r.inputs.burstA, 3);
  assert.equal(r.inputs.damageA, 7);
  assert.equal(r.inputs.ammoA, 'N');
  assert.equal(r.inputs.armB, 5);             // 2 + 3 cover
  assert.equal(r.inputs.btsB, 6);
  assert.equal(r.inputs.successValueB, 15);   // 12 + 3 range, attacker not in cover
  assert.equal(r.inputs.burstB, 1);           // ARO burst
  assert.equal(r.inputs.armA, 2);
  assert.equal(r.inputs.dtwVsDodge, false);
  assert.equal(r.inputs.fixedFaceToFace, false);
});

test('mimetism and MSV', () => {
  const mim3 = profile({skills: [{id: 28, name: 'Mimetism', extra: ['-3']}]});
  const mim6 = profile({skills: [{id: 28, name: 'Mimetism', extra: ['-6']}]});
  const msv1 = profile({equip: [{id: 114, name: 'Multispectral Visor L1'}]});
  const msv2 = profile({equip: [{id: 115, name: 'Multispectral Visor L2'}]});
  const sv = (a, b) => deriveInputs({active: side(a, combi, '1:'), reactive: side(b, combi, '1:'), rangeCm: 40}).inputs.successValueA;
  assert.equal(sv(profile(), mim3), 12);
  assert.equal(sv(profile(), mim6), 9);
  assert.equal(sv(msv1, mim3), 15);
  assert.equal(sv(msv1, mim6), 9);
  assert.equal(sv(msv2, mim6), 15);
});

test('AP halves ARM (rounding up) unless immune; cover added after', () => {
  const multi = option([{id: 2, name: 'MULTI Rifle'}]);
  const arm = (target, inCover = false) =>
    deriveInputs({active: side(profile(), multi, '2:AP Mode'), reactive: side(target, combi, '1:', inCover), rangeCm: 40}).inputs.armB;
  assert.equal(arm(profile({arm: 5})), 3);
  assert.equal(arm(profile({arm: 5}), true), 6);
  assert.equal(arm(profile({arm: 5, skills: [{id: 162, name: 'Immunity', extra: ['AP']}]})), 5);
});

test('ammo mapping from saves / saving', () => {
  const ammo = (id, key) => deriveInputs({active: side(profile(), option([{id, name: 'x'}]), key), reactive: null, rangeCm: 40}).inputs.ammoA;
  assert.equal(ammo(4, '4:'), 'DA');
  assert.equal(ammo(9, '9:Hit Mode'), 'EXP');
  assert.equal(ammo(5, '5:Hit Mode'), 'PLASMA');
  assert.equal(ammo(10, '10:'), 'T2');
  assert.equal(ammo(6, '6:'), 'N');
});

test('BTS weapons put the target BTS into the ARM input', () => {
  const viral = option([{id: 4, name: 'Viral Combi Rifle'}]);
  const r = deriveInputs({active: side(profile(), viral, '4:'), reactive: side(profile({arm: 5, bts: 9}), combi, '1:'), rangeCm: 40});
  assert.equal(r.inputs.armB, 9);
});

test('template weapon forces dodge, sets DTW and continuous damage', () => {
  const flamer = option([{id: 3, name: 'Heavy Flamethrower'}]);
  const target = profile({ph: 13, skills: [{id: 40, name: 'Dodge', extra: ['+3']}]});
  const r = deriveInputs({active: side(profile(), flamer, '3:'), reactive: side(target, combi, '1:'), rangeCm: 20});
  assert.equal(r.inputs.dtwVsDodge, true);
  assert.equal(r.inputs.burstA, 1);
  assert.equal(r.inputs.contA, true);
  assert.equal(r.inputs.ammoB, 'DODGE');
  assert.equal(r.inputs.burstB, 1);
  assert.equal(r.inputs.successValueB, 16);
  assert.ok(r.notes.some((n) => n.includes('Dodge')));
});

test('active Dodge: PH roll, no damage, reactive still shoots', () => {
  const dodger = profile({ph: 13, skills: [{id: 40, name: 'Dodge', extra: ['+3']}]});
  const r = deriveInputs({active: side(dodger, combi, 'dodge'), reactive: side(profile(), combi, '1:', true), rangeCm: 40});
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.inputs.ammoA, 'DODGE');
  assert.equal(r.inputs.burstA, 1);
  assert.equal(r.inputs.successValueA, 16);
  assert.equal(r.inputs.dtwVsDodge, false);
  assert.equal(r.inputs.successValueB, 15);   // 12 + 3 range, dodger not in cover
  assert.equal(r.inputs.burstB, 1);
  assert.equal(r.inputs.armA, 2);
  assert.deepEqual(pseudoWeapons(dodger, effectiveTraits(dodger, combi), 'A').map((w) => w.key), ['dodge']);
  assert.deepEqual(pseudoWeapons(dodger, effectiveTraits(dodger, combi), 'B').map((w) => w.key), ['dodge', 'none']);
  const vsTemplate = deriveInputs({active: side(dodger, combi, 'dodge'), reactive: side(profile(), option([{id: 3, name: 'Heavy Flamethrower'}]), '3:'), rangeCm: 20});
  assert.equal(vsTemplate.ok, false);
});

test('reactive burst: total reaction keeps weapon burst, "none" is unopposed', () => {
  const hmg = option([{id: 7, name: 'Heavy Machine Gun'}]);
  const rem = profile({skills: [{id: 61, name: 'Total Reaction'}]});
  assert.equal(deriveInputs({active: side(profile(), combi, '1:'), reactive: side(rem, hmg, '7:'), rangeCm: 40}).inputs.burstB, 4);
  assert.equal(deriveInputs({active: side(profile(), combi, '1:'), reactive: side(profile(), hmg, '7:'), rangeCm: 40}).inputs.burstB, 1);
  const none = deriveInputs({active: side(profile(), combi, '1:'), reactive: side(profile(), hmg, 'none'), rangeCm: 40});
  assert.equal(none.inputs.burstB, 0);
  assert.equal(none.ok, true);
});

test('loadout extras and crit immunity', () => {
  const o = option([{id: 1, name: 'Combi Rifle', extra: ['+1B', 'PS=9']}]);
  const target = profile({skills: [{id: 162, name: 'Immunity', extra: ['Critical']}]});
  const r = deriveInputs({active: side(profile(), o, '1:'), reactive: side(target, combi, '1:'), rangeCm: 40});
  assert.equal(r.inputs.burstA, 4);
  assert.equal(r.inputs.damageA, 9);
  assert.equal(r.inputs.critImmuneB, true);
});

test('out of range weapon blocks apply', () => {
  const pistol = option([{id: 6, name: 'Heavy Pistol'}]);
  const r = deriveInputs({active: side(profile(), pistol, '6:'), reactive: side(profile(), combi, '1:'), rangeCm: 120});
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /out of range/);
});

test('templates ignore the +3 ARM/BTS from cover but still eat the -3 BS MOD', () => {
  const plasma = option([{id: 11, name: 'Plasma Carbine'}]);
  const target = profile({arm: 4, bts: 6});
  const hit = deriveInputs({active: side(profile(), plasma, '11:Hit Mode'), reactive: side(target, combi, '1:', true), rangeCm: 40});
  const blast = deriveInputs({active: side(profile(), plasma, '11:Blast Mode'), reactive: side(target, combi, '1:', true), rangeCm: 40});
  assert.equal(hit.inputs.armB, 7);
  assert.equal(hit.inputs.btsB, 9);
  assert.equal(blast.inputs.armB, 4);
  assert.equal(blast.inputs.btsB, 6);
  assert.equal(blast.inputs.successValueA, hit.inputs.successValueA);   // cover -3 still applies
  const flamer = deriveInputs({active: side(profile(), option([{id: 3, name: 'Heavy Flamethrower'}]), '3:'), reactive: side(target, combi, '1:', true), rangeCm: 20});
  assert.equal(flamer.inputs.armB, 4);
});

test('No Cover units get nothing from "in cover"', () => {
  const tag = profile({arm: 8, bts: 6, skills: [{id: 264, name: 'No Cover'}]});
  const r = deriveInputs({active: side(profile(), combi, '1:'), reactive: side(tag, combi, '1:', true), rangeCm: 40});
  assert.equal(r.inputs.successValueA, 15);   // no -3 for cover
  assert.equal(r.inputs.armB, 8);
  assert.equal(r.inputs.btsB, 6);
  const normal = deriveInputs({active: side(profile(), combi, '1:'), reactive: side(profile({arm: 8}), combi, '1:', true), rangeCm: 40});
  assert.equal(normal.inputs.successValueA, 12);
  assert.equal(normal.inputs.armB, 11);
});

test('unsupported traits are reported as notes', () => {
  const p = profile({skills: [{id: 191, name: 'Surprise Attack', extra: ['-3']}, {id: 156, name: 'Marksmanship'}]});
  const r = deriveInputs({active: side(p, combi, '1:'), reactive: side(profile(), combi, '1:'), rangeCm: 40});
  assert.ok(r.notes.some((n) => n === 'Warning: support for Surprise Attack, Marksmanship not implemented yet'), r.notes.join(' | '));
});

test('Albedo penalises MSV and Marksmanship attackers only', () => {
  const albedo6 = profile({equip: [{id: 183, name: 'Albedo', extra: ['-6']}]});
  const plain = profile();
  const msv1 = profile({equip: [{id: 114, name: 'Multispectral Visor L1'}]});
  const msv2 = profile({equip: [{id: 115, name: 'Multispectral Visor L2'}]});
  const marksman = profile({skills: [{id: 156, name: 'Marksmanship'}]});
  const sv = (a, b) => deriveInputs({active: side(a, combi, '1:'), reactive: side(b, combi, '1:'), rangeCm: 40});
  assert.equal(sv(plain, albedo6).inputs.successValueA, 15);          // no visor, no effect
  assert.equal(sv(msv1, albedo6).inputs.successValueA, 9);            // 12 + 3 - 6
  assert.equal(sv(marksman, albedo6).inputs.successValueA, 9);
  const mimAlbedo = profile({skills: [{id: 28, name: 'Mimetism', extra: ['-3']}], equip: [{id: 183, name: 'Albedo', extra: ['-3']}]});
  assert.equal(sv(msv2, mimAlbedo).inputs.successValueA, 12);        // mimetism cancelled, albedo -3
  assert.equal(sv(plain, mimAlbedo).inputs.successValueA, 12);       // mimetism -3, no albedo
});

test('Nanoscreen works like cover, also against templates, and does not stack with cover', () => {
  const nano = profile({arm: 4, bts: 6, equip: [{id: 108, name: 'Nanoscreen'}]});
  const open = deriveInputs({active: side(profile(), combi, '1:'), reactive: side(nano, combi, '1:'), rangeCm: 40});
  assert.equal(open.inputs.successValueA, 12);   // 12 + 3 range - 3 nanoscreen
  assert.equal(open.inputs.armB, 7);
  assert.equal(open.inputs.btsB, 9);
  const covered = deriveInputs({active: side(profile(), combi, '1:'), reactive: side(nano, combi, '1:', true), rangeCm: 40});
  assert.equal(covered.inputs.successValueA, 12);
  assert.equal(covered.inputs.armB, 7);
  const plasma = option([{id: 11, name: 'Plasma Carbine'}]);
  const blast = deriveInputs({active: side(profile(), plasma, '11:Blast Mode'), reactive: side(nano, combi, '1:', true), rangeCm: 40});
  assert.equal(blast.inputs.armB, 7);            // cover ignored by the template, nanoscreen still applies
  assert.equal(blast.inputs.btsB, 9);
  const noCoverNano = profile({arm: 2, skills: [{id: 264, name: 'No Cover'}], equip: [{id: 108, name: 'Nanoscreen'}]});
  const r = deriveInputs({active: side(profile(), combi, '1:'), reactive: side(noCoverNano, combi, '1:', true), rangeCm: 40});
  assert.equal(r.inputs.successValueA, 12);
  assert.equal(r.inputs.armB, 5);
});

// --- real data -------------------------------------------------------------
const army = JSON.parse(readFileSync(new URL('../data/army.json', import.meta.url), 'utf8'));
const byIsc = (isc) => army.units.find((u) => u.isc === isc);

test('Hatamoto: six distinguishable loadouts and only BS weapons listed', () => {
  const hatamoto = byIsc('Hatamoto Imperial Guard');
  const group = hatamoto.byFaction['1102'].groups[0];
  const labels = loadoutLabels(group, army.weapons).map((l) => l.label);
  assert.equal(labels.length, 6);
  assert.equal(new Set(labels).size, 6);
  assert.match(labels[0], /Plasma Carbine/);
  assert.match(labels[0], /NCO/);
  assert.doesNotMatch(labels[0], /Heavy Pistol/);
  const names = bsWeapons(group.options[0], army.weapons).map((w) => w.label);
  assert.equal(names.length, 3);
  assert.ok(names.every((n) => /Plasma Carbine|Heavy Pistol/.test(n)));
});

test('matchupTraits lists only the traits the converter uses', () => {
  const hatamoto = byIsc('Hatamoto Imperial Guard');
  const active = resolveSelection(army, {unitId: hatamoto.id, optionId: 1, weaponKey: '111:Hit Mode', inCover: true});
  assert.deepEqual(matchupTraits(active), ['Mimetism (-3)', 'No Cover', 'Nanoscreen', 'X Visor']);
  const plain = side(profile({arm: 3}), combi, '1:', true);
  assert.deepEqual(matchupTraits(plain), ['In cover']);
  const dodger = side(profile({skills: [{id: 40, name: 'Dodge', extra: ['+3']}, {id: 162, name: 'Immunity', extra: ['Shock']}]}), combi, 'dodge');
  assert.deepEqual(matchupTraits(dodger), ['Dodge (+3)']);
});

test('Hatamoto plasma vs Sierra Dronbot HMG at 8-16"', () => {
  const hatamoto = byIsc('Hatamoto Imperial Guard');
  const sierra = byIsc('Sierra Dronbot');
  const active = resolveSelection(army, {unitId: hatamoto.id, optionId: 1, weaponKey: '111:Hit Mode'});
  const sierraGroup = sierra.byFaction['107'].groups[0];
  const hmg = bsWeapons(sierraGroup.options[0], army.weapons).find((w) => /Machine Gun/.test(w.name));
  const reactive = resolveSelection(army, {unitId: sierra.id, factionId: 107, optionId: sierraGroup.options[0].id, weaponKey: hmg.key, inCover: true});
  assert.equal(active.factionId, 1102);
  const r = deriveInputs({active, reactive, rangeCm: 40});
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.inputs.successValueA, 13);         // BS13 +3 -3 cover
  assert.equal(r.inputs.ammoA, 'PLASMA');
  assert.equal(r.inputs.damageA, 6);
  assert.equal(r.inputs.burstB, hmg.row.burst);     // Total Reaction
  // mimetism -3 and Hatamoto's Nanoscreen -3
  assert.equal(r.inputs.successValueB, sierra.byFaction['107'].groups[0].profiles[0].bs + hmg.row.ranges[1].mod - 6);
  assert.equal(r.inputs.armA, 2 + 3);               // Nanoscreen on saves
  assert.equal(r.inputs.armB, sierraGroup.profiles[0].arm + 3);
});
