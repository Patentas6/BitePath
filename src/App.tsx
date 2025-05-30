import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useIsMobile } from "@/hooks/use-mobile"; 

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfilePage from "./pages/ProfilePage"; 
import MealsPage from "./pages/MealsPage";
import BetaDisclaimerBanner from "@/components/BetaDisclaimerBanner";
import FeedbackPage from "./pages/FeedbackPage";
import ManageMealEntryPage from "./pages/ManageMealEntryPage"; 
import GroceryListPage from "./pages/GroceryListPage"; 
import PlanningPage from "./pages/PlanningPage";
import DiscoverMealsPage from "./pages/DiscoverMealsPage"; 
import MealDetailPage from "./pages/MealDetailPage";

const queryClient = new QueryClient();

const App = () => {
  const isMobile = useIsMobile(); 

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <Toaster offset={isMobile ? 240 : 20} /> 
        <TooltipProvider>
          <BrowserRouter>
            <>
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
                  path="/meal/:mealId" 
                  element={
                    <ProtectedRoute>
                      <MealDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/manage-meal-entry" 
                  element={
                    <ProtectedRoute>
                      <ManageMealEntryPage />
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
                  path="/planning"
                  element={
                    <ProtectedRoute>
                      <PlanningPage />
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
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;