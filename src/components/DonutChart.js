import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, numeric } from '../theme';

const GAP_DEGREES = 3; // small white gap between slices

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, outer, inner, start, end) {
  const large = end - start > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, outer, start);
  const [x1, y1] = polar(cx, cy, outer, end);
  const [x2, y2] = polar(cx, cy, inner, end);
  const [x3, y3] = polar(cx, cy, inner, start);
  return [
    `M ${x0} ${y0}`,
    `A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3}`,
    'Z',
  ].join(' ');
}

/**
 * slices: [{ key, value (0-1), color }]
 * selected: key of the highlighted slice (or null)
 */
export default function DonutChart({ slices, size = 120, selected, onSelect, centerTop, centerBottom }) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 4; // leave room for the "pop out" on selection
  const inner = outer * 0.62;

  let angle = 0;
  const arcs = slices.map((s) => {
    const sweep = s.value * 360;
    const start = angle + GAP_DEGREES / 2;
    const end = angle + sweep - GAP_DEGREES / 2;
    angle += sweep;
    const isSelected = selected === s.key;
    return {
      ...s,
      d: arcPath(cx, cy, isSelected ? outer + 4 : outer, inner, start, end),
      opacity: selected && !isSelected ? 0.35 : 1,
    };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {arcs.map((a) => (
          <Path
            key={a.key}
            d={a.d}
            fill={a.color}
            opacity={a.opacity}
            onPress={() => onSelect?.(selected === a.key ? null : a.key)}
          />
        ))}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.centerTop, numeric]}>{centerTop}</Text>
        <Text style={styles.centerBottom}>{centerBottom}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTop: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  centerBottom: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});
