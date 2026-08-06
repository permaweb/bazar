export const IMAGE_CONTENT_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
export const AUDIO_CONTENT_TYPES = new Set(['audio/mpeg', 'audio/wav']);

const CONTENT_TYPE_ALIASES = new Map([
  ['audio/mp3', 'audio/mpeg'],
  ['audio/x-mp3', 'audio/mpeg'],
  ['audio/wave', 'audio/wav'],
  ['audio/x-wav', 'audio/wav'],
  ['audio/vnd.wave', 'audio/wav'],
]);

const EXTENSION_CONTENT_TYPES = new Map([
  ['gif', 'image/gif'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['mp3', 'audio/mpeg'],
  ['png', 'image/png'],
  ['wav', 'audio/wav'],
  ['webp', 'image/webp'],
]);

export function normalizeAssetContentType(contentType: string | undefined, fileName = ''): string | null {
  const normalized = contentType?.split(';', 1)[0].trim().toLowerCase() ?? '';
  const canonical = CONTENT_TYPE_ALIASES.get(normalized) ?? normalized;
  if (IMAGE_CONTENT_TYPES.has(canonical) || AUDIO_CONTENT_TYPES.has(canonical)) return canonical;
  const extension = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? '';
  return EXTENSION_CONTENT_TYPES.get(extension) ?? null;
}

export function isImageContentType(contentType: string | undefined): boolean {
  const normalized = normalizeAssetContentType(contentType);
  return normalized !== null && IMAGE_CONTENT_TYPES.has(normalized);
}

export function isAudioContentType(contentType: string | undefined): boolean {
  const normalized = normalizeAssetContentType(contentType);
  return normalized !== null && AUDIO_CONTENT_TYPES.has(normalized);
}

export function isSupportedAssetContentType(contentType: string | undefined): boolean {
  return normalizeAssetContentType(contentType) !== null;
}

export function audioFormatLabel(contentType: string | undefined): string {
  return normalizeAssetContentType(contentType) === 'audio/wav' ? 'WAV' : 'MP3';
}
