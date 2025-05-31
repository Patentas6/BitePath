import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: [
    '/', 
    '/sign-in(.*)', 
    '/sign-up(.*)', 
    '/api/webhooks/clerk', 
    '/add-meal', // Keep this from previous attempt, just in case
    '/manage-meal-entry', // Make the correct meal entry page public
    '/meal-ideas(.*)', 
    '/api/generate-meal-image', 
    '/api/generate-recipe', 
  ],
  // Routes that can always be accessed, and have
  // no authentication information
  // ignoredRoutes: ['/no-auth-in-this-route'],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};