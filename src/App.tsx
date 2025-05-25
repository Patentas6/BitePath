import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes"; // Import ThemeProvider

import Index from "@/pages/Index.tsx"; // Updated import path
import NotFound from "@/pages/NotFound.tsx"; // Updated import path
import Auth from "@/pages/Auth.tsx"; // Updated import path
import Dashboard from "@/pages/Dashboard.tsx"; // Updated import path
import ProtectedRoute from "@/components/ProtectedRoute"; // Updated import path
import ProfilePage from "@/pages/Profile.tsx"; // Updated import path
import MealsPage from "@/pages/MealsPage.tsx"; // Updated import path
import DiscoverMealsPage from "@/pages/DiscoverMealsPage.tsx"; // Updated import path
import BetaDisclaimerBanner from "@/components/BetaDisclaimerBanner"; // Updated import path
import FeedbackPage from "@/pages/FeedbackPage.tsx"; // Updated import path
import PlannerViewPage from "@/pages/PlannerViewPage.tsx"; // Updated import path
import GroceryListPage from "@/pages/GroceryListPage.tsx"; // Updated import path
import AIMealGeneratorPage from "@/pages/AIMealGeneratorPage.tsx"; // Updated import path

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