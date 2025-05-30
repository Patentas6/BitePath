import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SupabaseImageTransformations {
  width?: number;
  height?: number; // Keep for specific cases like full-screen modal
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  resize?: 'cover' | 'contain' | 'fill';
}

export function transformSupabaseImage(
  originalUrl: string | null | undefined,
  options: SupabaseImageTransformations = {}
): string | undefined {
  if (!originalUrl) {
    console.log("[transformSupabaseImage] Original URL is null or undefined.");
    return undefined;
  }

  // console.log("[transformSupabaseImage] Attempting to transform:", originalUrl, "with options:", options);

  try {
    const url = new URL(originalUrl);
    
    const isRenderPath = url.pathname.startsWith('/storage/v1/render/image');
    const isObjectPath = url.pathname.startsWith('/storage/v1/object/public/');

    if (!isRenderPath && isObjectPath) {
      url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      // console.log("[transformSupabaseImage] Converted object path to render path:", url.pathname);
    } else if (!isRenderPath && !isObjectPath) {
      // console.warn("[transformSupabaseImage] URL is not a known Supabase public object URL. Returning original:", originalUrl);
      return originalUrl;
    }
    // If it's already a render path, Supabase typically ignores further render path segments if nested,
    // and applies the new query parameters. So, clearing old ones might be safer if re-transforming.
    // For now, we'll assume we append/override.

    const { width, height, quality = 75, format = 'webp', resize = 'contain' } = options;

    // Clear existing transformation params to avoid conflicts if re-transforming an already transformed URL
    // This is a guess; Supabase might handle this gracefully. Test to confirm.
    // const paramsToRemove = ['width', 'height', 'quality', 'format', 'resize'];
    // paramsToRemove.forEach(param => url.searchParams.delete(param));

    if (width) url.searchParams.set('width', String(width));
    if (height) url.searchParams.set('height', String(height)); // Only set if provided
    url.searchParams.set('quality', String(quality));
    url.searchParams.set('format', format);
    url.searchParams.set('resize', resize); // 'contain' is good default, 'cover' for fixed boxes
    
    const transformed = url.toString();
    // console.log("[transformSupabaseImage] Successfully transformed URL:", transformed);
    return transformed;

  } catch (error) {
    console.error("[transformSupabaseImage] Error transforming URL:", error, "Original URL:", originalUrl);
    return originalUrl; // Fallback to original URL on error
  }
}