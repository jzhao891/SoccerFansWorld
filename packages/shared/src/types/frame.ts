// Shared photo-frame shop contracts — no React, no React Native, no sharp.
// These types are the agreement between the /frames front end (frame picker +
// input form) and the server-side compositing engine. Pure data only; the
// engine owns all rendering, the front end owns all UI.

// ─── Geometry ──────────────────────────────────────────────────────────────────

// Pixel rectangle within a template's canvas (origin = top-left).
export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// How an image fills its rect when the aspect ratios differ.
export type ImageFit = 'cover' | 'contain' | 'fill';

// Mask applied to the user photo slot.
export type PhotoMask = 'none' | 'circle' | 'rounded';

// ─── Asset dimensions ────────────────────────────────────────────────────────────

// The categories of swappable artwork a customer chooses between. A frame
// template references these by name; the asset registry supplies the artwork.
// Extend by adding a value here and registering AssetDefinitions for it.
export const ASSET_DIMENSIONS = ['stadium', 'city', 'weather', 'gameInfo'] as const;
export type AssetDimension = (typeof ASSET_DIMENSIONS)[number];

// One piece of artwork available for a dimension, e.g. the "rain" weather overlay.
export type AssetDefinition = {
  id: string;              // unique, e.g. "weather-rain"
  dimension: AssetDimension;
  value: string;           // the selectable value, e.g. "rain"
  label: string;           // human label for the picker UI, e.g. "Rainy"
  src: string;             // full-resolution artwork URL/path
  thumbnail?: string;      // small preview for the picker
};

// A customer's chosen value per dimension. Partial — a template need not use
// every dimension, and some dimensions may be optional.
export type AssetSelection = Partial<Record<AssetDimension, string>>;

// ─── Text ────────────────────────────────────────────────────────────────────────

// Where a text layer's string comes from.
export type TextBinding =
  | { kind: 'input'; field: string }   // value of a TextInputField with this id
  | { kind: 'static'; value: string }; // fixed copy baked into the template

export type TextStyle = {
  fontFamily: string;
  fontSize: number;                       // px in canvas space
  color: string;                          // CSS color
  weight?: number;                        // 100–900
  align?: 'left' | 'center' | 'right';
  letterSpacing?: number;                 // px
  uppercase?: boolean;
};

// ─── Template layers ───────────────────────────────────────────────────────────────

// Layers are drawn in array order (first = bottom). Discriminated on `type` so
// the renderer can switch exhaustively.

// Artwork chosen by the customer for a given dimension (e.g. the stadium bg).
export type AssetLayer = {
  type: 'asset';
  source: AssetDimension;   // which selection fills this layer
  rect: Rect;
  fit: ImageFit;
};

// Static artwork owned by the template itself — not customer-swappable. This is
// the decorative frame border, corner flourishes, logos, etc.
export type OverlayLayer = {
  type: 'overlay';
  src: string;
  // Optional smaller/compressed stand-in for `src`, used for the live camera
  // preview (which only ever displays at a few hundred px) so the client
  // isn't downloading a multi-MB full-resolution PNG just to show a border on
  // screen. The server-side compositor always uses `src` for the final
  // render — this never affects output quality.
  previewSrc?: string;
  rect: Rect;
  fit: ImageFit;
};

// The customer's uploaded photo.
export type PhotoLayer = {
  type: 'photo';
  rect: Rect;
  fit: ImageFit;
  mask: PhotoMask;
};

// Text drawn from a customer input field or a fixed string.
export type TextLayer = {
  type: 'text';
  rect: Rect;
  bind: TextBinding;
  style: TextStyle;
};

// The SoccerFansWorld watermark. Rendered only on the free tier (see RenderTier);
// the engine owns placement, so no geometry is declared here.
export type WatermarkLayer = {
  type: 'watermark';
};

export type TemplateLayer =
  | AssetLayer
  | OverlayLayer
  | PhotoLayer
  | TextLayer
  | WatermarkLayer;

// ─── Templates ─────────────────────────────────────────────────────────────────────

// A free-text field the customer fills in, surfaced via a TextLayer's TextBinding.
export type TextInputField = {
  id: string;               // referenced by TextBinding.field
  label: string;            // form label, e.g. "Your city"
  placeholder?: string;
  maxLength?: number;
};

// Which asset dimensions this template lets the customer pick, and whether each
// is required. Drives the picker UI.
export type DimensionRequirement = {
  dimension: AssetDimension;
  required: boolean;
};

// A purchasable frame design. Adding a frame = adding one of these plus its
// assets; no new rendering code.
export type FrameTemplate = {
  id: string;
  name: string;
  size: { w: number; h: number };    // output canvas in px
  thumbnail: string;                  // catalog preview
  price?: number;                     // minor units (e.g. cents); omit for free frames
  dimensions: DimensionRequirement[];
  inputs: TextInputField[];
  layers: TemplateLayer[];
};

// ─── Rendering ─────────────────────────────────────────────────────────────────────

// Free = watermarked, low-res. Hd = clean, full-res (post-purchase).
export type RenderTier = 'free' | 'hd';

// Everything the compositing engine needs to produce one image. The engine
// resolves `selection` against the asset registry to fill AssetLayers, and
// `inputs` against the template's TextInputFields to fill TextLayers.
export type FrameRenderRequest = {
  templateId: string;
  photoDataUrl: string;              // the user's uploaded photo (data URL or path)
  selection: AssetSelection;
  inputs: Record<string, string>;    // TextInputField.id → entered value
  tier: RenderTier;
};
