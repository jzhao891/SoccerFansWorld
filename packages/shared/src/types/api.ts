import type { GoogleVenue } from './map';

export interface PlacesRequest {
  lat: number;
  lng: number;
  radiusMeters?: number;
}

export interface PlacesResponse {
  places: GoogleVenue[];
}

export interface PlacesErrorResponse {
  error: string;
}
