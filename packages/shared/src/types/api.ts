import type { PlaceResult } from './map';

export interface PlacesRequest {
  lat: number;
  lng: number;
  radiusMeters?: number;
}

export interface PlacesResponse {
  places: PlaceResult[];
}

export interface PlacesErrorResponse {
  error: string;
}
