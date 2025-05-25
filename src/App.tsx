import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

import Index from "./pages/Index.tsx"; // Reverted to relative path
import NotFound from "./pages/NotFound.tsx"; // Reverted to relative path
import Auth from "./pages/Auth.tsx"; // Reverted to relative path
import Dashboard from "./pages/Dashboard.tsx"; // Reverted to relative path
import ProtectedRoute from "./components/ProtectedRoute"; // Reverted to relative path
import ProfilePage from "./pages/Profile.tsx"; // Reverted to relative path
import MealsPage from "./pages/MealsPage.tsx"; // Reverted to relative path
import DiscoverMealsPage from "./pages/DiscoverMealsPage.tsx"; // Reverted to relative path
import BetaDisclaimerBanner from "./components/BetaDisclaimerBanner"; // Reverted to relative path
import FeedbackPage from "./pages/FeedbackPage.tsx"; // Reverted to relative path
import PlannerViewPage from "./pages/PlannerViewPage.tsx"; // Reverted to relative path
import GroceryListPage from "./pages/GroceryListPage.tsx"; // Reverted to relative path
import AIMealGeneratorPage from "./pages/AIMealGeneratorPage.tsx"; // Reverted to relative path

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