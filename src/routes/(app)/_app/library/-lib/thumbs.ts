/**
 * Small versions of stored files for the grid, made by Cloudflare at the edge from the
 * public media URL: an image resized to WebP/AVIF (Image Transformations), a video's frame
 * one second in (Media Transformations). A few widths only, so each is made once and
 * cached. What Cloudflare cannot transform falls back to the original (see MediaImage).
 */

export type ThumbWidth = 160 | 480;

function parts(publicUrl: string) {
  const url = new URL(publicUrl);
  return { origin: url.origin, path: url.pathname };
}

export function imageThumb(publicUrl: string, width: ThumbWidth) {
  const { origin, path } = parts(publicUrl);
  return `${origin}/cdn-cgi/image/width=${width},fit=scale-down,format=auto,quality=80${path}`;
}

export function videoFrame(publicUrl: string, width: ThumbWidth) {
  const { origin, path } = parts(publicUrl);
  return `${origin}/cdn-cgi/media/mode=frame,time=1s,width=${width}${path}`;
}
