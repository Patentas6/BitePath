import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: [
    '/', // Assuming your homepage is public
    '/sign-in(.*)', // Allow all sign-in related paths
    '/sign-up(.*)', // Allow all sign-up related paths
    '/api/webhooks/clerk', // Clerk webhook
    '/add-meal', // Temporarily make add-meal public for testing
    '/meal-ideas(.*)', // Assuming meal-ideas is public or handled differently
    '/api/generate-meal-image', // API route for image generation
    '/api/generate-recipe', // API route for recipe generation
  ],
  // Routes that can always be accessed, and have
  // no authentication information
  // ignoredRoutes: ['/no-auth-in-this-route'],
});

export const config = {
  // Protects all routes, including api/trpc.
  // See https://clerk.com/docs/references/nextjs/auth-middleware
  // for more information about configuring your Middleware
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};