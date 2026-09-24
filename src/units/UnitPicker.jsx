import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Autocomplete,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {createFilterOptions} from '@mui/material/Autocomplete';
import {useTheme} from '@mui/material/styles';
import PropTypes from 'prop-types';
import {twoDecimalPlaces} from '../display/DataTransform.js';
import {SKILL, bsWeapons, effectiveTraits, loadoutLabels, pseudoWeapons, rangeModFor} from './profileToInputs.js';

export const EMPTY_SELECTION = {
  unitId: null,
  factionId: null,
  groupId: null,
  profileId: null,
  optionId: null,
  weaponKey: null,
  inCover: false,
};

const filterOptions = createFilterOptions({stringify: (u) => `${u.isc} ${u.name ?? ''}`});

// Labels carry a lot of detail (weapon · B · PS · range · W/order), so on
// phones shrink the text and let rows wrap instead of truncating.
const compactText = {fontSize: {xs: '0.8rem', sm: '1rem'}, whiteSpace: 'normal'};
const selectSx = {'& .MuiSelect-select': {...compactText, lineHeight: 1.3}};
const menuProps = {sx: {'& .MuiMenuItem-root': {...compactText, lineHeight: 1.3}}};

function SelectField({label, value, onChange, color, field, open, onOpen, onClose, children}) {
  return (
    <FormControl fullWidth size="small" color={color}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        open={open}
        onOpen={onOpen}
        onClose={onClose}
        sx={selectSx}
        MenuProps={menuProps}
        SelectDisplayProps={{'data-field': field}}
      >
        {children}
      </Select>
    </FormControl>
  );
}

SelectField.propTypes = {
  field: PropTypes.string,
  open: PropTypes.bool,
  onOpen: PropTypes.func,
  onClose: PropTypes.func,
  label: PropTypes.string,
  value: PropTypes.any,
  onChange: PropTypes.func,
  color: PropTypes.string,
  children: PropTypes.node,
};

// "+3" / "-6" / "out of range" for the weapon at the shared distance.
function rangeText(row, rangeCm) {
  const mod = rangeModFor(row, rangeCm);
  if (mod === null) return 'out of range';
  return `${mod > 0 ? '+' : ''}${mod} range`;
}

// Expected wounds per order from usePreviewWounds: number, 'pending' or null.
function previewText(preview) {
  if (preview === 'pending') return ' · …';
  if (typeof preview === 'number') return ` · ~${twoDecimalPlaces(preview)} wounds`;
  return '';
}

function UnitPicker({variant, army, rangeCm, previews, value, onChange}) {
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
  const pseudo = useMemo(
    () => (variant === 'reactive' && profile ? pseudoWeapons(profile, effectiveTraits(profile, option)) : []),
    [variant, profile, option],
  );

  const noCover = Boolean(profile) && effectiveTraits(profile, option).skills.some((s) => s.id === SKILL.NO_COVER);

  const set = (patch) => onChange({...value, ...patch});

  const [inputValue, setInputValue] = useState(unit?.isc ?? '');
  const [open, setOpen] = useState(false);

  // Defaults that need a state write: a single loadout, and the first BS weapon.
  useEffect(() => {
    if (noCover && value.inCover) {
      set({inCover: false});
    } else if (group && !value.optionId && options.length === 1) {
      set({optionId: options[0].id, weaponKey: null});
      setPendingFocus('weapon');
    } else if (option && !value.weaponKey && weapons.length > 0) {
      set({weaponKey: weapons[0].key});
    }
  });

  // Move focus down the form and open the menu: unit -> next select,
  // loadout -> weapon. The target may only exist after the next render, so
  // retry until it does.
  const rootRef = useRef(null);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [openField, setOpenField] = useState(null);
  useEffect(() => {
    if (!pendingFocus || !rootRef.current) return;
    const selector = pendingFocus === 'weapon' ? '[data-field="weapon"]' : '[data-field]';
    const el = rootRef.current.querySelector(selector);
    if (el) {
      el.focus();
      setOpenField(el.dataset.field);
      setPendingFocus(null);
    }
  }, [pendingFocus, value]);
  const fieldProps = (name) => ({
    field: name,
    open: openField === name,
    onOpen: () => setOpenField(name),
    onClose: () => setOpenField(null),
  });

  const factionName = (id) => army.factions[id]?.name ?? `Faction ${id}`;

  return (
    <Grid container spacing={1.5} ref={rootRef}>
      <Grid item xs={12}>
        <Typography variant="h6" sx={{fontFamily: 'conthrax', color: headerColor}}>
          {variant === 'active' ? 'Active' : 'Reactive'}
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Autocomplete
          size="small"
          options={army.units}
          value={unit}
          onChange={(event, u) => {
            onChange({...EMPTY_SELECTION, unitId: u?.id ?? null, inCover: value.inCover});
            if (u) setPendingFocus('next');
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
                  {u.inFactions.map(factionName).join(', ')}
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
            onChange={(id) => set({factionId: id, groupId: null, profileId: null, optionId: null, weaponKey: null})}
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
            onChange={(id) => set({groupId: id, profileId: null, optionId: null, weaponKey: null})}
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
            onChange={(id) => set({profileId: id})}
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
            color={color}
            value={option?.id ?? null}
            onChange={(id) => {
              set({optionId: id, weaponKey: null});
              setPendingFocus('weapon');
            }}
          >
            {labels.map((l) => (
              <MenuItem key={l.id} value={l.id}>{l.label}</MenuItem>
            ))}
          </SelectField>
        </Grid>
      )}
      {option && (
        <Grid item xs={12}>
          <SelectField
            label="Weapon"
            color={color}
            {...fieldProps('weapon')}
            value={value.weaponKey}
            onChange={(key) => set({weaponKey: key})}
          >
            {[
              <ListSubheader key="bs">BS weapons</ListSubheader>,
              ...weapons.map((w) => (
                <MenuItem key={w.key} value={w.key}>
                  {`${w.label} · ${rangeText(w.row, rangeCm)}${previewText(previews?.[w.key])}`}
                </MenuItem>
              )),
              ...(pseudo.length > 0 ? [<ListSubheader key="other">Other</ListSubheader>] : []),
              ...pseudo.map((w) => <MenuItem key={w.key} value={w.key}>{w.label}</MenuItem>),
            ]}
          </SelectField>
          {weapons.length === 0 && (
            <Typography variant="caption" color="text.secondary">No BS weapons in this profile.</Typography>
          )}
        </Grid>
      )}
      {unit && (
        <Grid item xs={12} sx={{mt: -1}}>
          <FormControlLabel
            control={
              <Checkbox
                color={color}
                checked={!noCover && value.inCover}
                onChange={(e) => set({inCover: e.target.checked})}
                sx={{py: 0.5}}
              />
            }
            disabled={noCover}
            label={noCover ? 'In cover (unit has No Cover)' : 'In cover'}
            sx={{'& .MuiFormControlLabel-label': {fontSize: compactText.fontSize}}}
          />
        </Grid>
      )}
    </Grid>
  );
}

UnitPicker.propTypes = {
  variant: PropTypes.oneOf(['active', 'reactive']).isRequired,
  army: PropTypes.object.isRequired,
  rangeCm: PropTypes.number.isRequired,
  previews: PropTypes.object,
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default UnitPicker;
