/** Encoded representations supported by the universal contract. */
export type OutputFormat = 'avif' | 'webp' | 'jpeg' | 'png' | 'gif' | 'svg';
/** Resizing semantics; provider capabilities may restrict this set. */
export type Fit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | 'scale-down';
export type Position = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'attention' | 'entropy';
/** Public, serializable image request. Keys never contain signing secrets. */
export interface ImageRequest {
  url?: string;
  key?: string;
  w?: number;
  h?: number;
  dpr?: number;
  q?: number;
  format?: OutputFormat | 'auto';
  fit?: Fit;
  position?: Position;
  blur?: number;
  sharpen?: number;
  bg?: string;
  rotate?: 0 | 90 | 180 | 270;
  flip?: 'none' | 'horizontal' | 'vertical' | 'both';
  metadata?: 'none' | 'icc' | 'safe';
  animation?: 'preserve' | 'first';
  preset?: string;
  rev?: string;
  kid?: string;
  exp?: number;
  sig?: string;
}
/** Normalized requests always include stable defaults. */
export type NormalizedRequest = ImageRequest & Required<Pick<ImageRequest, 'dpr' | 'q' | 'format' | 'fit' | 'position' | 'metadata' | 'animation' | 'rotate' | 'flip' | 'blur' | 'sharpen'>>;
export interface Preset {
  values: ImageRequest;
  overrides: readonly (keyof ImageRequest)[];
  revision: string;
}
export interface ImageConfig {
  provider?: ImageProvider;
  providers?: Readonly<Record<string, ImageProvider>>;
  widths: readonly number[];
  qualities: readonly number[];
  formats: readonly OutputFormat[];
  quality: number;
  maxDimension: number;
  maxPixels: number;
  maxInputBytes: number;
  maxOutputBytes: number;
  timeoutMs: number;
  allowedOrigins: readonly string[];
  presets: Readonly<Record<string, Preset>>;
  endpoint: string;
  placeholder: 'lqip' | 'color' | 'none' | 'thumbhash' | 'blurhash';
}
export interface ImageSource {
  type: string;
  srcset: string;
  media?: string;
  width?: number;
  height?: number;
}
/** Result of a typed image import; contains no server implementation. */
export interface ImageArtifact {
  src: string;
  srcset: string;
  sources: ImageSource[];
  width: number;
  height: number;
  aspectRatio: number;
  placeholder?: string;
  dominantColor?: string;
  hash?: string;
}
export interface ProviderCapabilities {
  explicitFormat?: boolean;
  fixed?: boolean;
  maxWidthByFormat?: Partial<Record<OutputFormat, number>>;
  formats: readonly OutputFormat[];
  fit: readonly Fit[];
  smartCrop: boolean;
  animation: boolean;
  signature: boolean;
}
/** Portable provider. Purging and credentialed operations live in server helpers. */
export interface ImageProvider {
  name: string;
  capabilities: ProviderCapabilities;
  buildUrl(params: ImageRequest): string;
  validate(): void;
  purge?(keys: readonly string[]): Promise<void>;
}
