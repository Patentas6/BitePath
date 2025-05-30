import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SupabaseImageTransformations {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  resize?: 'cover' | 'contain' | 'fill';
}

export function transformSupabaseImage(
  originalUrl: string | null | undefined,
  options: SupabaseImageTransformations = {}
): string | undefined {
  if (!originalUrl) {
    // This log is expected if a meal genuinely has no image_url
    // console.log("[transformSupabaseImage] Original URL is null or undefined. No transformation possible.");
    return undefined;
  }

  // console.log(`[transformSupabaseImage] Attempting to transform: '${originalUrl}' with options:`, options);

  try {
    const url = new URL(originalUrl);
    let newPathname = url.pathname;

    const objectPublicPath = '/storage/v1/object/public/';
    const renderImagePath = '/storage/v1/render/image/public/';

    if (newPathname.startsWith(objectPublicPath)) {
      newPathname = newPathname.replace(objectPublicPath, renderImagePath);
      // console.log(`[transformSupabaseImage] Path converted from object to render: '${newPathname}'`);
    } else if (!newPathname.startsWith(renderImagePath)) {
      // console.warn(`[transformSupabaseImage] URL '${originalUrl}' is not a known Supabase public object or render path. Returning original.`);
      return originalUrl;
    }
    
    url.pathname = newPathname; // Update the pathname on the URL object

    const { width, height, quality = 75, format = 'webp', resize = 'contain' } = options;

    // Clear existing transformation query parameters to prevent conflicts if re-transforming
    const existingSearchParams = new URLSearchParams(url.search);
    const paramsToRemove = ['width', 'height', 'quality', 'format', 'resize', 'transform']; // 'transform' is sometimes used
    paramsToRemove.forEach(param => existingSearchParams.delete(param));
    
    // Reconstruct search string without old transformation params
    url.search = existingSearchParams.toString(); 
    
    // Now add new transformation params
    if (width) url.searchParams.set('width', String(width));
    if (height) url.searchParams.set('height', String(height)); // Only set if provided
    url.searchParams.set('quality', String(quality));
    url.searchParams.set('format', format);
    url.searchParams.set('resize', resize);
    
    const transformed = url.toString();
    // console.log(`[transformSupabaseImage] Successfully transformed URL to: '${transformed}'`);
    return transformed;

  } catch (error) {
    console.error(`[transformSupabaseImage] Error transforming URL '${originalUrl}':`, error);
    return originalUrl; // Fallback to original URL on error
  }
}