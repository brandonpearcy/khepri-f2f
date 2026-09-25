import {SvgIcon} from '@mui/material';

const TICKS = [4, 7, 10, 13, 16, 19];

// A chunky ruler: taller than FontAwesome's ruler-horizontal so a row of them
// sits level with the square-ish icons elsewhere (Burst dice, riflemen).
function RulerIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 18">
      <rect x="0.5" y="1" width="23" height="16" rx="2" />
      {TICKS.map((x, i) => (
        <rect key={x} x={x} y="1" width="1" height={i % 2 ? 3 : 4.5} fill="rgba(0,0,0,0.35)" />
      ))}
    </SvgIcon>
  );
}

export default RulerIcon;
