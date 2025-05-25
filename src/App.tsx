import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

import Index from "@/pages/Index.tsx"; // Using @ alias
import NotFound from "@/pages/NotFound.tsx"; // Using @ alias
import Auth from "@/pages/Auth.tsx"; // Using @ alias
import Dashboard from "@/pages/Dashboard.tsx"; // Using @ alias
import ProtectedRoute from "@/components/ProtectedRoute"; // Using @ alias
import ProfilePage from "@/pages/Profile.tsx"; // Using @ alias
import MealsPage from "@/pages/MealsPage.tsx"; // Using @ alias
import DiscoverMealsPage from "@/pages/DiscoverMealsPage.tsx"; // Using @ alias
import BetaDisclaimerBanner from "@/components/BetaDisclaimerBanner"; // Using @ alias
import FeedbackPage from "@/pages/FeedbackPage.tsx"; // Using @ alias
import PlannerViewPage from "@/pages/PlannerViewPage.tsx"; // Using @ alias
import GroceryListPage from "@/pages/GroceryListPage.tsx"; // Using @ alias
import AIMealGeneratorPage from "@/pages/AIMealGeneratorPage.tsx"; // Using @ alias

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
              path="/planner"
              element={
                <ProtectedRoute>
                  <PlannerViewPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/grocery-list"
              element={
                <ProtectedRoute>
                  <GroceryListPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/ai-meal"
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