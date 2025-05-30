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
    return undefined;
  }

  try {
    const url = new URL(originalUrl);
    // Ensure we are working with a Supabase storage URL
    // Example: https://<project_id>.supabase.co/storage/v1/object/public/images/meal.png
    // We want to transform it to: https://<project_id>.supabase.co/storage/v1/render/image/public/images/meal.png?width=...
    
    // Check if it's already a render URL (e.g., from a previous transformation)
    // Or if it's a direct object URL that needs to be converted
    const isRenderPath = url.pathname.startsWith('/storage/v1/render/image');
    const isObjectPath = url.pathname.startsWith('/storage/v1/object/public/');

    if (!isRenderPath && isObjectPath) {
      // Convert object/public/ path to render/image/public path
      url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    } else if (!isRenderPath && !isObjectPath) {
      // If it's not a known Supabase storage path, return original or handle as error
      // For now, let's assume it might be a non-transformable URL or already transformed externally
      // console.warn("URL does not appear to be a standard Supabase public object URL for transformation:", originalUrl);
      // return originalUrl; // Or return undefined if strict transformation is required
    }
    // If it's already a render path, we can still append/override options if needed,
    // but Supabase might have specific rules for chained transformations.
    // For simplicity, we'll assume we're applying options to a base URL or a convertible one.

    const { width, height, quality = 75, format = 'webp', resize = 'contain' } = options;

    if (width) url.searchParams.set('width', String(width));
    if (height) url.searchParams.set('height', String(height));
    url.searchParams.set('quality', String(quality));
    url.searchParams.set('format', format);
    url.searchParams.set('resize', resize);
    
    return url.toString();

  } catch (error) {
    console.error("Error transforming Supabase image URL:", error, "Original URL:", originalUrl);
    return originalUrl || undefined; // Fallback to original URL on error
  }
}