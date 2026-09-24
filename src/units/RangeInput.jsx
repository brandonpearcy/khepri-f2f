import {faRulerHorizontal} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {Box, Grid, InputLabel, Rating, Tooltip} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import PropTypes from 'prop-types';
import {RANGE_BANDS} from './profileToInputs.js';

// Each icon carries its band's upper limit in inches.
function BandIcon({value, children, ...other}) {
  const band = RANGE_BANDS[value - 1];
  return (
    <span {...other} style={{position: 'relative', display: 'inline-flex'}}>
      {children}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'conthrax',
          fontSize: '0.6rem',
          fontWeight: 700,
          color: 'text.primary',
          pointerEvents: 'none',
        }}
      >
        {band?.inches}
      </Box>
    </span>
  );
}

BandIcon.propTypes = {
  value: PropTypes.number.isRequired,
  children: PropTypes.node,
};

// Distance between the two troopers, as a Burst-style icon row (no number box;
// the icons carry the inches). Both columns show the same shared value.
function RangeInput({rangeCm, update, variant}) {
  const theme = useTheme();
  const colorMid = theme.palette[variant]['500'];
  const index = RANGE_BANDS.findIndex((b) => b.to === rangeCm);
  // Rulers are wider than the Burst dice and there are seven; keep them tight.
  const iconStyle = {padding: 1};
  return (
    <>
      <Grid item xs={12} sx={{display: 'flex', justifyContent: 'left'}}>
        <Tooltip title="Distance between the two troopers, in the weapon chart's range bands (inches).">
          <InputLabel>Range</InputLabel>
        </Tooltip>
      </Grid>
      {/* Indented to line up with the number boxes of the inputs below. */}
      <Grid item xs={12} sx={{display: 'flex', justifyContent: 'left', alignItems: 'center', pl: 3}}>
        <Rating
          max={RANGE_BANDS.length}
          sx={{fontSize: '1.6rem'}}
          value={index + 1}
          // Re-clicking the current band would clear a Rating; a range always has a value.
          onChange={(e, n) => n && update(RANGE_BANDS[n - 1].to)}
          getLabelText={(n) => `Range up to ${RANGE_BANDS[n - 1].inches} inches`}
          IconContainerComponent={BandIcon}
          icon={<FontAwesomeIcon fontSize="inherit" style={{...iconStyle, color: colorMid}} icon={faRulerHorizontal} />}
          emptyIcon={<FontAwesomeIcon fontSize="inherit" style={{...iconStyle, opacity: 0.35}} icon={faRulerHorizontal} />}
        />
      </Grid>
    </>
  );
}

RangeInput.propTypes = {
  rangeCm: PropTypes.number.isRequired,
  update: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['active', 'reactive']),
};

RangeInput.defaultProps = {
  variant: 'active',
};

export default RangeInput;
