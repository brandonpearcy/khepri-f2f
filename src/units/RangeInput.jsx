import {Box, Grid, InputLabel, Rating, Tooltip} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import PropTypes from 'prop-types';
import {CONTROL_ROW_HEIGHT} from './layout.js';
import RulerIcon from '../componets/RulerIcon.jsx';
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
          // Nudged down, clear of the tick marks.
          pt: '0.2em',
          fontFamily: 'conthrax',
          fontSize: '0.7rem',
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
  const iconSx = {px: '1px'};
  return (
    <>
      <Grid item xs={12} sx={{display: 'flex', justifyContent: 'left'}}>
        <Tooltip title="Distance between the two troopers, in the weapon chart's range bands (inches).">
          <InputLabel>Range</InputLabel>
        </Tooltip>
      </Grid>
      {/* Indented to line up with the number boxes of the inputs below. */}
      <Grid item xs={12} sx={{display: 'flex', justifyContent: 'left', alignItems: 'center', pl: 3, height: CONTROL_ROW_HEIGHT}}>
        <Rating
          max={RANGE_BANDS.length}
          sx={{fontSize: '2.1rem'}}
          value={index + 1}
          // Re-clicking the current band would clear a Rating; a range always has a value.
          onChange={(e, n) => n && update(RANGE_BANDS[n - 1].to)}
          getLabelText={(n) => `Range up to ${RANGE_BANDS[n - 1].inches} inches`}
          IconContainerComponent={BandIcon}
          icon={<RulerIcon fontSize="inherit" sx={{...iconSx, color: colorMid}} />}
          emptyIcon={<RulerIcon fontSize="inherit" sx={{...iconSx, opacity: 0.35}} />}
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
