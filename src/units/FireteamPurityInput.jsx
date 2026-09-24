import {faPersonRifle} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {Grid, InputLabel, Rating, Tooltip} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import PropTypes from 'prop-types';
import UncontrolledInput from '../componets/UncontrolledInput.jsx';
import {FIRETEAM_MAX, FIRETEAM_MIN} from './profileToInputs.js';

// 0 (not in a Fireteam) or FIRETEAM_MIN..FIRETEAM_MAX; 1 isn't a Fireteam.
const normalize = (n) => (n < FIRETEAM_MIN ? 0 : Math.min(FIRETEAM_MAX, n));

// Same layout as BurstInput: typed number, then a row of icons.
function FireteamPurityInput({value, update, variant}) {
  const theme = useTheme();
  const colorMid = theme.palette[variant]['500'];
  return (
    <>
      <Grid item xs={12} sx={{display: 'flex', justifyContent: 'left'}}>
        <Tooltip title="Fireteam members from the same Unit. 2: +1 SD, 3: +1 Dodge, 4: +1 BS, 5: Sixth Sense.">
          <InputLabel>Fireteam Purity</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={2} sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1}}>
        <UncontrolledInput
          key={value}
          value={value}
          variant={variant}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(n)) update(normalize(n));
          }}
        />
      </Grid>
      <Grid item xs={1} />
      <Grid item xs={9} sx={{display: 'flex', justifyContent: 'left', alignItems: 'center'}}>
        <Rating
          max={FIRETEAM_MAX}
          size="large"
          value={value}
          // The first icon (and re-clicking the current size) means 0.
          onChange={(e, n) => update(normalize(n ?? 0))}
          getLabelText={(n) => `Fireteam Purity ${n}`}
          icon={<FontAwesomeIcon fontSize="inherit" style={{padding: 2, color: colorMid}} icon={faPersonRifle} />}
          emptyIcon={<FontAwesomeIcon fontSize="inherit" style={{padding: 2, opacity: 0.55}} icon={faPersonRifle} />}
        />
      </Grid>
    </>
  );
}

FireteamPurityInput.propTypes = {
  value: PropTypes.number.isRequired,
  update: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['active', 'reactive']),
};

FireteamPurityInput.defaultProps = {
  variant: 'active',
};

export default FireteamPurityInput;
