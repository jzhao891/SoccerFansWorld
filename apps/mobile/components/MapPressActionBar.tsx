import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';

const POPUP_WIDTH = 140;
const ARROW_HALF = 7;  // borderLeftWidth / borderRightWidth
const BOTTOM_MARGIN = 60;

interface Props {
  screen: { x: number; y: number };
  onCreateParty: () => void;
}

export default function MapPressActionBar({ screen, onCreateParty }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const minBottom = insets.bottom + BOTTOM_MARGIN;
  const cappedY = Math.min(screen.y, height - BOTTOM_MARGIN);
  const left = Math.max(spacing.md, Math.min(screen.x - POPUP_WIDTH / 2, width - POPUP_WIDTH - spacing.md));
  const bottom = Math.max(minBottom, height - cappedY + 16);
  // Shift the arrow to point at the actual tap x, even when popup is edge-clamped
  const arrowMarginLeft = Math.max(0, Math.min(screen.x - left - ARROW_HALF, POPUP_WIDTH - ARROW_HALF * 2));

  return (
    <View style={[styles.container, { bottom, left }]} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={onCreateParty}
      >
        <Text style={styles.btnText}>Create fan zone</Text>
      </Pressable>
      <View style={[styles.arrow, { marginLeft: arrowMarginLeft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: POPUP_WIDTH,
    zIndex: 30,
    alignItems: 'flex-start',
  },
  card: {
    backgroundColor: 'rgba(60,60,60,0.92)',
    borderRadius: radius.lg,
    width: POPUP_WIDTH,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...shadow.md,
  },
  cardPressed: { opacity: 0.75 },
  btnText: { fontSize: 13, fontWeight: '600', color: colors.white },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(60,60,60,0.92)',
  },
});
