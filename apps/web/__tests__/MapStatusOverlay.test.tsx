import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import MapStatusOverlay from '@/components/MapStatusOverlay';
import { useMapStore } from '@/store/mapStore';
import type { GoogleVenue, FanZone } from '@sfw/shared';

const initialState = useMapStore.getState();

beforeEach(() => {
  useMapStore.setState(initialState);
});

// Bounds inside Seattle allowed region
const seattleBounds = { north: 47.65, south: 47.55, east: -122.25, west: -122.40 };
// Bounds well outside all allowed regions
const outsideBounds = { north: 51.6, south: 51.4, east: 0.2, west: -0.3 }; // London — not a host city

const mockPlace: GoogleVenue = {
  source: 'google',
  id: 'gp_001',
  name: 'The Pub',
  location: { lat: 47.6, lng: -122.3 },
  types: ['bar'],
};

const mockFanZone: FanZone = {
  id: 'fz_001',
  source: 'google',
  venue_id: 'gp_001',
  name: 'The Pub',
  address: '1 Test St, Seattle, WA',
  location: { lat: 47.6, lng: -122.3 },
  geohash: 'c23nb',
  event_title: 'World Cup 2026',
  start_time: 0,
  watching_teams: ['England'],
  amenities: [],
  activity_status: 'ACTIVE',
  created_by: 'user_1',
  created_at: 0,
};

describe('MapStatusOverlay', () => {
  it('shows spinner while fetching', () => {
    useMapStore.setState({ isFetchingPlaces: true, bounds: seattleBounds, places: [], fanZones: [] });
    render(<MapStatusOverlay />);
    expect(screen.getByText('Finding venues…')).toBeInTheDocument();
  });

  it('shows out-of-region message when bounds are outside allowed regions', () => {
    useMapStore.setState({ isFetchingPlaces: false, bounds: outsideBounds, places: [], fanZones: [] });
    render(<MapStatusOverlay />);
    expect(screen.getByText('Pan to a supported city to see fan venues')).toBeInTheDocument();
  });

  it('shows empty state when in-region but no venues', () => {
    useMapStore.setState({ isFetchingPlaces: false, bounds: seattleBounds, places: [], fanZones: [] });
    render(<MapStatusOverlay />);
    expect(screen.getByText('No fan venues found in this area')).toBeInTheDocument();
  });

  it('shows team-specific empty state when team filter active and no matches', () => {
    useMapStore.setState({
      isFetchingPlaces: false,
      bounds: seattleBounds,
      places: [mockPlace],
      fanZones: [mockFanZone],
      selectedTeam: 'Brazil', // no venue watching Brazil
    });
    render(<MapStatusOverlay />);
    expect(screen.getByText('No venues watching Brazil in this area')).toBeInTheDocument();
  });

  it('renders nothing when venues are visible', () => {
    useMapStore.setState({
      isFetchingPlaces: false,
      bounds: seattleBounds,
      places: [mockPlace],
      fanZones: [],
      selectedTeam: null,
    });
    const { container } = render(<MapStatusOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('spinner takes priority over empty state', () => {
    useMapStore.setState({ isFetchingPlaces: true, bounds: seattleBounds, places: [], fanZones: [] });
    render(<MapStatusOverlay />);
    expect(screen.getByText('Finding venues…')).toBeInTheDocument();
    expect(screen.queryByText('No fan venues found in this area')).not.toBeInTheDocument();
  });
});
