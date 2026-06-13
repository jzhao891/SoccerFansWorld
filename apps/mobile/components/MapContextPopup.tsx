import Mapbox from '@rnmapbox/maps';

interface Props {
  location: { lat: number; lng: number };
}

// Renders only the pin marker inside the MapView — no buttons here.
// Buttons live in MapPressActionBar (outside MapView) to avoid Mapbox touch interception.
export default function MapContextPopup({ location }: Props) {
  return (
    <Mapbox.PointAnnotation
      id="map-press-pin"
      coordinate={[location.lng, location.lat]}
    >
      <></>
    </Mapbox.PointAnnotation>
  );
}
