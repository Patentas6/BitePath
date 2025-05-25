import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfilePage from "./pages/Profile";
import MealsPage from "./pages/MealsPage"; // This page will be refactored
import PlannerViewPage from "./pages/PlannerViewPage"; // New page
import GroceryListPage from "./pages/GroceryListPage"; // New page
import BetaDisclaimerBanner from "./components/BetaDisclaimerBanner";
import FeedbackPage from "./pages/FeedbackPage";
// AIRecipeGeneratorPage will be integrated into MealsPage, so no separate route needed here for now

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
                  <MealsPage /> {/* This will be the hub for My Meals, Create, AI, Templates */}
                </ProtectedRoute>
              }
            />
             <Route
              path="/planner" // New route for Planner View
              element={
                <ProtectedRoute>
                  <PlannerViewPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/grocery-list" // New route for Grocery List
              element={
                <ProtectedRoute>
                  <GroceryListPage />
                </ProtectedRoute>
              }
            />
            {/* Removed /discover-meals route */}
            {/* Removed /ai-recipe-generator route */}
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;