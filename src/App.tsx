import React, { lazy, Suspense } from "react"; // <-- MODIFIED: Added lazy and Suspense
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useIsMobile } from "@/hooks/use-mobile"; 

// PageLoader for Suspense fallback
import PageLoader from "./components/PageLoader"; // <-- ADDED
import BetaDisclaimerBanner from "@/components/BetaDisclaimerBanner";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy load page components
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProfilePage = lazy(() => import("./pages/ProfilePage")); 
const MealsPage = lazy(() => import("./pages/MealsPage"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));
const ManageMealEntryPage = lazy(() => import("./pages/ManageMealEntryPage")); 
const GroceryListPage = lazy(() => import("./pages/GroceryListPage")); 
const PlanningPage = lazy(() => import("./pages/PlanningPage"));
const DiscoverMealsPage = lazy(() => import("./pages/DiscoverMealsPage")); 
const MealDetailPage = lazy(() => import("./pages/MealDetailPage"));

const queryClient = new QueryClient();

const App = () => {
  const isMobile = useIsMobile(); 

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <Toaster offset={isMobile ? 80 : 20} /> 
        <TooltipProvider>
          <BrowserRouter>
            <>
              <BetaDisclaimerBanner />
              <Suspense fallback={<PageLoader />}> {/* <-- ADDED: Suspense wrapper */}
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
              </Suspense> {/* <-- ADDED: Closing Suspense wrapper */}
            </>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;