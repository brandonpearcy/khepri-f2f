import {Grid, InputLabel, Rating, Tooltip} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import PropTypes from 'prop-types';
import {CONTROL_ROW_HEIGHT} from './layout.js';
import BrickWallIcon from '../componets/BrickWallIcon.jsx';
import {SKILL} from './profileToInputs.js';

// "In cover" for one side of the matchup, in the Burst pattern: a single brick
// wall toggles cover on/off, then a short note of what it does. Units with
// No Cover can't take cover.
function CoverInput({variant, matchup}) {
  const theme = useTheme();
  const colorMid = theme.palette[variant]['500'];
  const side = variant === 'active' ? 'A' : 'B';
  const {sel, setSel, resolved} = matchup[side];
  const noCover = (resolved?.traits?.skills ?? []).some((s) => s.id === SKILL.NO_COVER);
  const inCover = Boolean(sel.inCover) && !noCover;

  let note = 'Not in cover';
  if (noCover) note = 'Unit has No Cover';
  else if (inCover) note = '−3 to hit it, +3 ARM/BTS';

  return (
    <>
      <Grid item xs={12} sx={{display: 'flex', justifyContent: 'left'}}>
        <Tooltip title="Partial cover: attackers get −3 to hit and the trooper gets +3 ARM/BTS (not against templates).">
          <InputLabel>Cover</InputLabel>
        </Tooltip>
      </Grid>
      {/* Wall indented like the Range rulers; the note starts where the icon
          scales of the inputs below do (after their xs=2 number + xs=1 gap). */}
      <Grid item xs={3} sx={{display: 'flex', alignItems: 'center', pl: 3, height: CONTROL_ROW_HEIGHT}}>
        <Rating
          max={1}
          size="large"
          value={inCover ? 1 : 0}
          disabled={noCover}
          // Clicking the lit wall clears the Rating: out of cover.
          onChange={(e, n) => setSel({...sel, inCover: n === 1})}
          getLabelText={() => 'In cover'}
          icon={<BrickWallIcon fontSize="inherit" sx={{color: colorMid}} />}
          emptyIcon={<BrickWallIcon fontSize="inherit" sx={{opacity: 0.55}} />}
        />
      </Grid>
      {/* pl matches the padding around the icons in those scales. */}
      <Grid item xs={9} sx={{display: 'flex', alignItems: 'center', pl: 0.5, height: CONTROL_ROW_HEIGHT}}>
        {/* Off: same dimmed grey as the unselected icons (Rating empty colour at 0.55). */}
        <InputLabel component="span" sx={inCover ? undefined : {color: 'action.disabled', opacity: 0.55}}>
          {note}
        </InputLabel>
      </Grid>
    </>
  );
}

CoverInput.propTypes = {
  variant: PropTypes.oneOf(['active', 'reactive']).isRequired,
  matchup: PropTypes.object.isRequired,
};

export default CoverInput;
