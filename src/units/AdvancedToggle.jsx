import {Grid, InputLabel} from '@mui/material';
import PropTypes from 'prop-types';

// "Advanced »" text link that shows/hides the calculator's raw value scales.
// An InputLabel rendered as a button, so it matches the control labels.
function AdvancedToggle({open, onToggle}) {
  return (
    <Grid item xs={12} sx={{mt: 1}}>
      <InputLabel
        component="button"
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        sx={{
          background: 'none',
          border: 0,
          p: 0,
          cursor: 'pointer',
          '&:hover, &:focus-visible': {color: 'text.primary'},
        }}
      >
        {/* » (U+00BB) collapsed, ︾ (U+FE3E, double down chevron) expanded. */}
        {open ? 'Advanced \uFE3E' : 'Advanced \u00BB'}
      </InputLabel>
    </Grid>
  );
}

AdvancedToggle.propTypes = {
  open: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default AdvancedToggle;
