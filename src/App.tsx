import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes"; // Import ThemeProvider

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfilePage from "./pages/Profile";
import MealsPage from "./pages/MealsPage";
// import DiscoverMealsPage from "./pages/DiscoverMealsPage"; // Removed import
import BetaDisclaimerBanner from "./components/BetaDisclaimerBanner";
import FeedbackPage from "./pages/FeedbackPage";
import GenerateMealPage from "./pages/GenerateMealPage"; // Import the new page

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BetaDisclaimerBanner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meals"
              element={
                <ProtectedRoute>
                  <MealsPage />
                </ProtectedRoute>
              }
            />
            {/* Removed Discover Meals Route */}
            {/* <Route
              path="/discover-meals"
              element={
                <ProtectedRoute>
                  <DiscoverMealsPage />
                </ProtectedRoute>
              }
            /> */}
             <Route
              path="/generate-meal" // New route path
              element={
                <ProtectedRoute>
                  <GenerateMealPage /> {/* Render the new page */}
                </ProtectedRoute>
              }
            />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;