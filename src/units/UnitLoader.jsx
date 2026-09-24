import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CachedIcon from '@mui/icons-material/Cached';
import EditIcon from '@mui/icons-material/Edit';
import PropTypes from 'prop-types';
import UnitPicker, {EMPTY_SELECTION} from './UnitPicker.jsx';
import {RANGE_BANDS, deriveInputs, matchupTraits, resolveSelection, searchKey} from './profileToInputs.js';
import {previewCandidates} from './previews.js';
import usePreviewWounds from './usePreviewWounds.js';

// "HATAMOTO Plasma Carbine (Hit)" for the collapsed summary: the loadout's
// short name from Army, then the weapon.
function sideSummary(resolved) {
  if (!resolved?.unit) return '—';
  const short = resolved.option?.name ?? resolved.unit.name ?? resolved.unit.isc;
  const w = resolved.weapon;
  let weapon = '';
  if (w?.pseudo) weapon = w.label;
  else if (w) weapon = `${w.name}${w.mode ? ` (${w.mode.replace(/ Mode$/i, '')})` : ''}`;
  return weapon ? `${short} · ${weapon}` : short;
}

function SideLine({resolved, color}) {
  const traits = matchupTraits(resolved);
  return (
    <Box>
      <Typography variant="body1" sx={{color, fontWeight: 600}}>{sideSummary(resolved)}</Typography>
      {traits.length > 0 && (
        <Typography variant="caption" color="text.secondary">{traits.join(', ')}</Typography>
      )}
    </Box>
  );
}

SideLine.propTypes = {
  resolved: PropTypes.object,
  color: PropTypes.string.isRequired,
};

function UnitLoader({calculate, onApply}) {
  const [army, setArmy] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const loading = useRef(false);
  useEffect(() => {
    if (loading.current) return;
    loading.current = true;
    import('../data/army.json')
      .then((m) => {
        const units = m.default.units.map((u) => ({...u, search: searchKey(u.isc)}));
        setArmy({...m.default, units});
      })
      .catch((e) => setLoadError(e));
  }, []);

  const [selA, setSelA] = useState(EMPTY_SELECTION);
  const [selB, setSelB] = useState(EMPTY_SELECTION);
  const [rangeCm, setRangeCm] = useState(40);
  // After "Apply matchup" the pickers fold away behind a one-line summary.
  const [collapsed, setCollapsed] = useState(false);

  const resolvedA = useMemo(() => (army ? resolveSelection(army, selA) : null), [army, selA]);
  const resolvedB = useMemo(() => (army ? resolveSelection(army, selB) : null), [army, selB]);
  const derived = useMemo(
    () => (army ? deriveInputs({active: resolvedA, reactive: resolvedB, rangeCm}) : null),
    [army, rangeCm, resolvedA, resolvedB],
  );

  const hasSelection = Boolean(selA.unitId || selB.unitId);

  // Wounds/order for every weapon option, given the other side's current pick.
  // Nothing is computed while collapsed.
  const candidatesA = useMemo(
    () => (army && !collapsed ? previewCandidates({army, side: 'A', selX: selA, selY: selB, rangeCm}) : []),
    [army, collapsed, rangeCm, selA, selB],
  );
  const candidatesB = useMemo(
    () => (army && !collapsed ? previewCandidates({army, side: 'B', selX: selB, selY: selA, rangeCm}) : []),
    [army, collapsed, rangeCm, selA, selB],
  );
  const previewsA = usePreviewWounds(candidatesA, calculate);
  const previewsB = usePreviewWounds(candidatesB, calculate);

  // "No ARO" only exists on the reactive side; drop it so the new active side
  // auto-picks its first BS weapon. Dodge is valid on both sides.
  const swapSides = () => {
    setSelA({...selB, weaponKey: selB.weaponKey === 'none' ? null : selB.weaponKey});
    setSelB(selA);
  };

  const applyMatchup = () => {
    onApply(derived.inputs);
    setCollapsed(true);
  };

  const rangeLabel = RANGE_BANDS.find((b) => b.to === rangeCm)?.label ?? `${rangeCm} cm`;

  // Sits between the columns on wide screens, in the card's top-right corner
  // when the columns stack.
  const swapButton = (
    <Tooltip title="Swap active and reactive">
      <span>
        <Button
          variant="outlined"
          size="small"
          color="inherit"
          startIcon={<CachedIcon />}
          disabled={!hasSelection}
          onClick={swapSides}
          sx={{borderColor: 'text.secondary', whiteSpace: 'nowrap', px: '9px', py: '3px'}}
        >
          Swap
        </Button>
      </span>
    </Tooltip>
  );

  if (collapsed) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{flex: 1, minWidth: 0}}>
              <Stack direction={{xs: 'column', sm: 'row'}} spacing={2} alignItems={{xs: 'stretch', sm: 'center'}}>
                <Box sx={{flex: 1, minWidth: 0}}>
                  <SideLine resolved={resolvedA} color="active.500" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{alignSelf: 'center'}}>vs</Typography>
                <Box sx={{flex: 1, minWidth: 0}}>
                  <SideLine resolved={resolvedB} color="reactive.500" />
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>Range: {rangeLabel}</Typography>
            </Box>
            <Tooltip title="Edit matchup">
              <IconButton
                aria-label="edit matchup"
                onClick={() => setCollapsed(false)}
                sx={{border: 1, borderColor: 'text.secondary'}}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{mb: 1.5}}>
              <Typography variant="h6" sx={{fontFamily: 'conthrax'}}>Range</Typography>
              {army && <Box sx={{display: {xs: 'block', md: 'none'}}}>{swapButton}</Box>}
            </Stack>
            <FormControl fullWidth size="small">
              <Select value={rangeCm} onChange={(e) => setRangeCm(e.target.value)}>
                {RANGE_BANDS.map((b) => (
                  <MenuItem key={b.to} value={b.to}>{b.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {loadError && (
            <Grid item xs={12}>
              <Alert severity="error">Could not load unit data: {String(loadError.message ?? loadError)}</Alert>
            </Grid>
          )}
          {!army && !loadError && (
            <Grid item xs={12}>
              <CircularProgress size={24} />
            </Grid>
          )}
          {army && (
            <>
              <Grid item xs={12}>
                <Stack direction={{xs: 'column', md: 'row'}} spacing={2} alignItems="stretch">
                  <Box sx={{flex: 1, minWidth: 0}}>
                    <UnitPicker
                      army={army}
                      onChange={setSelA}
                      previews={previewsA}
                      rangeCm={rangeCm}
                      value={selA}
                      variant="active"
                    />
                  </Box>
                  <Box sx={{display: {xs: 'none', md: 'flex'}, alignItems: 'center', justifyContent: 'center', mx: 2}}>
                    {swapButton}
                  </Box>
                  <Box sx={{flex: 1, minWidth: 0}}>
                    <UnitPicker
                      army={army}
                      onChange={setSelB}
                      previews={previewsB}
                      rangeCm={rangeCm}
                      value={selB}
                      variant="reactive"
                    />
                  </Box>
                </Stack>
              </Grid>
              {hasSelection && derived && (
                <Grid item xs={12}>
                  <Stack spacing={1}>
                    {derived.errors.map((e) => (
                      <Alert key={e} severity="warning">{e}</Alert>
                    ))}
                    {derived.notes.map((n) => (
                      <Typography key={n} variant="caption" color="text.secondary">{n}</Typography>
                    ))}
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        disabled={!derived.ok}
                        onClick={applyMatchup}
                        sx={{
                          bgcolor: 'text.primary',
                          color: 'background.paper',
                          '&:hover': {bgcolor: 'text.secondary'},
                        }}
                      >
                        Pew pew!
                      </Button>
                      <Button
                        variant="text"
                        sx={{color: 'text.primary'}}
                        onClick={() => {
                          setSelA(EMPTY_SELECTION);
                          setSelB(EMPTY_SELECTION);
                        }}
                      >
                        Clear
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>
              )}
            </>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}

UnitLoader.propTypes = {
  calculate: PropTypes.func,
  onApply: PropTypes.func.isRequired,
};

export default UnitLoader;
