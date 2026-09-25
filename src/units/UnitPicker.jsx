import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Autocomplete,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import PropTypes from 'prop-types';
import {bsWeapons, loadoutLabels, searchKey} from './profileToInputs.js';
import SelectField, {compactText} from './SelectField.jsx';
import {EMPTY_SELECTION} from './useMatchup.js';

// Match the ISC only, ignoring case and accents (`search` is built at load).
const filterOptions = (units, {inputValue}) => {
  const q = searchKey(inputValue.trim());
  return units.filter((u) => u.search.includes(q));
};

// Unit, faction, profile and loadout for one side. The weapon (auto-set to the
// loadout's first BS weapon) and cover are set in the calculator column.
function UnitPicker({variant, army, value, onChange, headerAction}) {
  const theme = useTheme();
  const color = variant === 'active' ? 'primary' : 'secondary';
  const headerColor = theme.palette[variant]['500'];

  const unit = army.units.find((u) => u.id === value.unitId) ?? null;
  const factionIds = unit?.inFactions ?? [];
  const factionId = value.factionId ?? (factionIds.length === 1 ? factionIds[0] : null);
  const groups = factionId ? unit?.byFaction[factionId]?.groups ?? [] : [];
  const group = groups.find((g) => g.id === value.groupId) ?? (groups.length === 1 ? groups[0] : null);
  const profiles = group?.profiles ?? [];
  const profile = profiles.find((p) => p.id === value.profileId) ?? (profiles.length === 1 ? profiles[0] : null);
  const options = group?.options ?? [];
  const option = options.find((o) => o.id === value.optionId) ?? null;

  const labels = useMemo(() => (group ? loadoutLabels(group, army.weapons) : []), [group, army.weapons]);
  const weapons = useMemo(() => (option ? bsWeapons(option, army.weapons) : []), [option, army.weapons]);

  const set = (patch) => onChange({...value, ...patch});

  const [inputValue, setInputValue] = useState(unit?.isc ?? '');
  const [open, setOpen] = useState(false);

  // Defaults that need a state write: a single loadout, and the first BS weapon.
  useEffect(() => {
    if (group && !value.optionId && labels.length === 1) {
      set({optionId: labels[0].id, weaponKey: null});
    } else if (option && !value.weaponKey && weapons.length > 0) {
      set({weaponKey: weapons[0].key});
    }
  });

  // After picking a unit, faction, profile group or stat profile, focus and
  // open the next select that still needs a choice. It may only exist after the next render, so retry until it does;
  // stop once a loadout is set (the weapon is picked automatically).
  const rootRef = useRef(null);
  const [pendingFocus, setPendingFocus] = useState(false);
  const [openField, setOpenField] = useState(null);
  useEffect(() => {
    if (!pendingFocus || !rootRef.current) return;
    const el = rootRef.current.querySelector('[data-field][data-needs-choice="true"]');
    if (el) {
      el.focus();
      setOpenField(el.dataset.field);
      setPendingFocus(false);
    } else if (option) {
      setPendingFocus(false);
    }
  }, [pendingFocus, value, option]);
  const fieldProps = (name) => ({
    field: name,
    open: openField === name,
    onOpen: () => setOpenField(name),
    onClose: () => setOpenField(null),
  });

  const factionName = (id) => army.factions[id]?.name ?? `Faction ${id}`;
  // Units like Fusiliers sit in half a dozen factions; keep the row short.
  const factionCaption = (ids) =>
    ids.length > 2 ? `${factionName(ids[0])} +${ids.length - 1}` : ids.map(factionName).join(', ');

  return (
    <Grid container spacing={1.5} ref={rootRef}>
      <Grid item xs={12} sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <Typography variant="h6" sx={{fontFamily: 'conthrax', color: headerColor}}>
          {variant === 'active' ? 'Active' : 'Reactive'}
        </Typography>
        {headerAction}
      </Grid>
      <Grid item xs={12}>
        <Autocomplete
          size="small"
          options={army.units}
          value={unit}
          onChange={(event, u) => {
            onChange({...EMPTY_SELECTION, unitId: u?.id ?? null, inCover: value.inCover});
            if (u) setPendingFocus(true);
          }}
          getOptionLabel={(u) => u.isc}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={filterOptions}
          autoHighlight
          blurOnSelect
          // Suggestions only while the user is typing; focusing or clicking a
          // field that already holds a unit shows nothing.
          inputValue={inputValue}
          onInputChange={(event, text, reason) => {
            setInputValue(text);
            if (reason === 'input') setOpen(text.trim() !== '');
          }}
          open={open}
          onClose={() => setOpen(false)}
          forcePopupIcon={false}
          renderOption={(props, u) => {
            // MUI 5.14 keys rows by label; key by id so duplicate names never collide.
            const {key, ...rest} = props;
            return (
              <li key={u.id} {...rest}>
                {u.isc}
                <Typography variant="caption" color="text.secondary" sx={{ml: 1}}>
                  {factionCaption(u.inFactions)}
                </Typography>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Unit"
              color={color}
              placeholder="Type a unit name"
              sx={{'& .MuiInputBase-input': {fontSize: compactText.fontSize}}}
            />
          )}
          ListboxProps={{sx: {'& .MuiAutocomplete-option': {fontSize: compactText.fontSize}}}}
        />
      </Grid>
      {unit && factionIds.length > 1 && (
        <Grid item xs={12}>
          <SelectField
            label="Faction"
            {...fieldProps('faction')}
            color={color}
            value={factionId}
            onChange={(id) => {
              set({factionId: id, groupId: null, profileId: null, optionId: null, weaponKey: null});
              setPendingFocus(true);
            }}
          >
            {factionIds.map((id) => (
              <MenuItem key={id} value={id}>{factionName(id)}</MenuItem>
            ))}
          </SelectField>
        </Grid>
      )}
      {groups.length > 1 && (
        <Grid item xs={12}>
          <SelectField
            label="Profile group"
            {...fieldProps('group')}
            color={color}
            value={group?.id ?? null}
            onChange={(id) => {
              set({groupId: id, profileId: null, optionId: null, weaponKey: null});
              setPendingFocus(true);
            }}
          >
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>{g.isc ?? g.profiles[0]?.name ?? `Group ${g.id}`}</MenuItem>
            ))}
          </SelectField>
        </Grid>
      )}
      {profiles.length > 1 && (
        <Grid item xs={12}>
          <SelectField
            label="Stat profile"
            {...fieldProps('stat')}
            color={color}
            value={profile?.id ?? null}
            onChange={(id) => {
              set({profileId: id});
              setPendingFocus(true);
            }}
          >
            {profiles.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name ?? `Profile ${p.id}`}</MenuItem>
            ))}
          </SelectField>
        </Grid>
      )}
      {group && (
        <Grid item xs={12}>
          <SelectField
            label="Profile"
            {...fieldProps('loadout')}
            needsChoice={!option && labels.length > 1}
            color={color}
            value={option?.id ?? null}
            onChange={(id) => set({optionId: id, weaponKey: null})}
          >
            {labels.map((l) => (
              <MenuItem key={l.id} value={l.id}>{l.label}</MenuItem>
            ))}
          </SelectField>
        </Grid>
      )}
    </Grid>
  );
}

UnitPicker.propTypes = {
  variant: PropTypes.oneOf(['active', 'reactive']).isRequired,
  army: PropTypes.object.isRequired,
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  // Rendered at the right end of the title row (e.g. the Swap button).
  headerAction: PropTypes.node,
};

export default UnitPicker;
