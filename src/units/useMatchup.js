import {useEffect, useMemo, useRef, useState} from 'react';
import {deriveInputs, resolveSelection, searchKey} from './profileToInputs.js';
import {previewCandidates} from './previews.js';
import usePreviewWounds from './usePreviewWounds.js';

export const EMPTY_SELECTION = {
  unitId: null,
  factionId: null,
  groupId: null,
  profileId: null,
  optionId: null,
  weaponKey: null,
  inCover: false,
  // Team-Ops: index into unit.upgrades.chart / .ball, or null.
  upgrade: null,
  ball: null,
};

const NO_FIRETEAM = {A: 0, B: 0};

// Matchup state shared by the unit picker card and the calculator columns
// (weapon and Fireteam Purity live there). Army data loads once `enabled`.
// Every valid matchup is pushed into the calculator through onApply.
export default function useMatchup({enabled, calculate, onApply}) {
  const [army, setArmy] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const loading = useRef(false);
  useEffect(() => {
    if (!enabled || loading.current) return;
    loading.current = true;
    import('../data/army.json')
      .then((m) => {
        const units = m.default.units.map((u) => ({...u, search: searchKey(u.isc)}));
        setArmy({...m.default, units});
      })
      .catch((e) => setLoadError(e));
  }, [enabled]);

  const [pickA, setPickA] = useState(EMPTY_SELECTION);
  const [pickB, setPickB] = useState(EMPTY_SELECTION);
  const [ftSize, setFtSizes] = useState(NO_FIRETEAM);
  const selA = useMemo(() => ({...pickA, ftSize: ftSize.A}), [pickA, ftSize.A]);
  const selB = useMemo(() => ({...pickB, ftSize: ftSize.B}), [pickB, ftSize.B]);
  const [rangeCm, setRangeCm] = useState(40);
  // "Minify" folds the pickers away behind a one-line summary.
  const [collapsed, setCollapsed] = useState(false);

  const resolvedA = useMemo(() => (army ? resolveSelection(army, selA) : null), [army, selA]);
  const resolvedB = useMemo(() => (army ? resolveSelection(army, selB) : null), [army, selB]);
  const derived = useMemo(
    () => (army ? deriveInputs({active: resolvedA, reactive: resolvedB, rangeCm}) : null),
    [army, rangeCm, resolvedA, resolvedB],
  );

  const hasSelection = Boolean(selA.unitId || selB.unitId);
  // Both sides fully chosen (unit through weapon) and the matchup is valid.
  const complete = Boolean(resolvedA?.weapon && resolvedB?.weapon && derived?.ok);

  // Wounds/order for every weapon option, given the other side's current pick.
  const candidatesA = useMemo(
    () => (army && enabled ? previewCandidates({army, side: 'A', selX: selA, selY: selB, rangeCm}) : []),
    [army, enabled, rangeCm, selA, selB],
  );
  const candidatesB = useMemo(
    () => (army && enabled ? previewCandidates({army, side: 'B', selX: selB, selY: selA, rangeCm}) : []),
    [army, enabled, rangeCm, selA, selB],
  );
  const previewsA = usePreviewWounds(candidatesA, calculate);
  const previewsB = usePreviewWounds(candidatesB, calculate);

  // onApply is a new function each App render, so read it through a ref.
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  useEffect(() => {
    if (enabled && hasSelection && derived?.ok) onApplyRef.current(derived.inputs);
  }, [derived, enabled, hasSelection]);

  // "No ARO" only exists on the reactive side; drop it so the new active side
  // auto-picks its first BS weapon. Dodge is valid on both sides.
  const swapSides = () => {
    setPickA({...pickB, weaponKey: pickB.weaponKey === 'none' ? null : pickB.weaponKey});
    setPickB(pickA);
    setFtSizes({A: ftSize.B, B: ftSize.A});
  };

  const reset = () => {
    setPickA(EMPTY_SELECTION);
    setPickB(EMPTY_SELECTION);
    setFtSizes(NO_FIRETEAM);
  };

  const side = (s) => (s === 'A'
    ? {sel: selA, setSel: setPickA, resolved: resolvedA, previews: previewsA}
    : {sel: selB, setSel: setPickB, resolved: resolvedB, previews: previewsB});

  return {
    army,
    loadError,
    rangeCm,
    setRangeCm,
    collapsed,
    setCollapsed,
    derived,
    hasSelection,
    complete,
    swapSides,
    reset,
    ftSize,
    setFtSize: (s, n) => setFtSizes((f) => ({...f, [s]: n})),
    A: side('A'),
    B: side('B'),
  };
}
