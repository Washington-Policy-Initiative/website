/** Photo sizes. CSS sizes live in tokens.css (--avatar-size, -ml, -lg). */
export type AvatarSize = 'md' | 'ml' | 'lg';

/** Pixel width to request from the image pipeline: 2x the CSS size, for high-density screens. */
export const AVATAR_PX: Record<AvatarSize, number> = { md: 224, ml: 288, lg: 352 };
