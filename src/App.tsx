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
import BetaDisclaimerBanner from "@/components/BetaDisclaimerBanner"; // Corrected import path
import FeedbackPage from "./pages/FeedbackPage";
import GenerateMealPage from "./pages/GenerateMealPage";
import AddMealPage from "./pages/AddMealPage";
import WeeklyPlanPage from "./pages/WeeklyPlanPage"; // Import the WeeklyPlanPage
import GroceryListPage from "./pages/GroceryListPage"; // Import the GroceryListPage

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      {/* Toaster and Sonner are global and can be outside */}
      <Toaster />
      <Sonner />
      <TooltipProvider>
        <BrowserRouter>
          {/* BetaDisclaimerBanner needs to be inside BrowserRouter because it uses Link */}
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
              path="/generate-meal"
              element={
                <ProtectedRoute>
                  <GenerateMealPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/add-meal"
              element={
                <ProtectedRoute>
                  <AddMealPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/weekly-plan"
              element={
                <ProtectedRoute>
                  <WeeklyPlanPage />
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
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;