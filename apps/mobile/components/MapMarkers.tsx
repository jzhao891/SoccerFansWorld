import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useMergedPlaces, useMapStore } from '@sfw/shared';
import type { MergedPlace } from '@sfw/shared';
import { colors, shadow } from '../theme';

const SOURCE_COLORS: Record<MergedPlace['source'], string> = {
  google: colors.pinGoogle,
  custom: colors.pinCustom,
  merged: colors.pinMerged,
};

export default function MapMarkers() {
  const mergedPlaces = useMergedPlaces();
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedTeam = useMapStore((s) => s.selectedTeam);

  const visiblePlaces = selectedTeam
    ? mergedPlaces.filter((p) => p.fanZone?.watching_teams.includes(selectedTeam) ?? false)
    : mergedPlaces;

  return (
    <>
      {visiblePlaces.map((place) => (
        <Mapbox.PointAnnotation
          key={place.place_id}
          id={place.place_id}
          coordinate={[place.location.lng, place.location.lat]}
          anchor={{ x: 0.5, y: 1 }}
          onSelected={() => setSelectedPlaceId(place.place_id)}
        >
          <TouchableOpacity onPress={() => setSelectedPlaceId(place.place_id)}>
            <View
              style={[
                styles.marker,
                { backgroundColor: SOURCE_COLORS[place.source] },
              ]}
            />
          </TouchableOpacity>
        </Mapbox.PointAnnotation>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.white,
    ...shadow.sm,
  },
});
