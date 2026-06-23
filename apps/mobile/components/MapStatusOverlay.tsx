import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useMapStore, useMergedPlaces, ALLOWED_REGIONS } from '@sfw/shared';
import { colors, spacing, radius, shadow } from '../theme';

export default function MapStatusOverlay() {
  const isFetchingPlaces = useMapStore((s) => s.isFetchingPlaces);
  const bounds = useMapStore((s) => s.bounds);
  const mergedPlaces = useMergedPlaces();
  const selectedTeam = useMapStore((s) => s.selectedTeam);

  const inAllowedRegion =
    bounds != null &&
    ALLOWED_REGIONS.some(
      ({ bounds: r }) =>
        bounds.west < r.east &&
        bounds.east > r.west &&
        bounds.south < r.north &&
        bounds.north > r.south,
    );

  const visiblePlaces = selectedTeam
    ? mergedPlaces.filter((p) => p.fanZones?.some((fz) => fz.watching_teams?.includes(selectedTeam)) ?? false)
    : mergedPlaces;

  if (isFetchingPlaces) {
    return (
      <View style={styles.container} pointerEvents="none">
        <View style={styles.pill}>
          <ActivityIndicator size="small" color="#6B7280" style={{ marginRight: 8 }} />
          <Text style={styles.text}>Finding venues…</Text>
        </View>
      </View>
    );
  }

  if (!inAllowedRegion) {
    return (
      <View style={styles.container} pointerEvents="none">
        <View style={styles.card}>
          <Text style={styles.text}>Pan to a supported city to see fan venues</Text>
        </View>
      </View>
    );
  }

  if (visiblePlaces.length === 0) {
    return (
      <View style={styles.container} pointerEvents="none">
        <View style={styles.card}>
          <Text style={styles.text}>
            {selectedTeam
              ? `No venues watching ${selectedTeam} in this area`
              : 'No fan venues found in this area'}
          </Text>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xxl + spacing.sm,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.md,
  },
  text: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
