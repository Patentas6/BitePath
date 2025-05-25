import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes"; // Import ThemeProvider

import Index from "./pages/Index.tsx"; // Added .tsx
import NotFound from "./pages/NotFound.tsx"; // Added .tsx
import Auth from "./pages/Auth.tsx"; // Added .tsx
import Dashboard from "./pages/Dashboard.tsx"; // Added .tsx
import ProtectedRoute from "./components/ProtectedRoute";
import ProfilePage from "./pages/Profile.tsx"; // Added .tsx
import MealsPage from "./pages/MealsPage.tsx"; // Added .tsx
import DiscoverMealsPage from "./pages/DiscoverMealsPage.tsx"; // Added .tsx
import BetaDisclaimerBanner from "./components/BetaDisclaimerBanner";
import FeedbackPage from "./pages/FeedbackPage.tsx"; // Added .tsx
import PlannerViewPage from "./pages/PlannerViewPage.tsx"; // Added .tsx
import GroceryListPage from "./pages/GroceryListPage.tsx"; // Added .tsx
import AIMealGeneratorPage from "./pages/AIMealGeneratorPage.tsx"; // Added .tsx

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
            <Route
              path="/discover-meals"
              element={
                <ProtectedRoute>
                  <DiscoverMealsPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/planner" // Add Planner route
              element={
                <ProtectedRoute>
                  <PlannerViewPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/grocery-list" // Add Grocery List route
              element={
                <ProtectedRoute>
                  <GroceryListPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/ai-meal" // Add AI Meal Generator route
              element={
                <ProtectedRoute>
                  <AIMealGeneratorPage />
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