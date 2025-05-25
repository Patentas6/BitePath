import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

// Import all necessary pages
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import ProfilePage from "./pages/Profile.tsx";
import MealsPage from "./pages/MealsPage.tsx";
import DiscoverMealsPage from "./pages/DiscoverMealsPage.tsx";
import FeedbackPage from "./pages/FeedbackPage.tsx";
import PlannerViewPage from "./pages/PlannerViewPage.tsx";
import GroceryListNew from "./pages/GroceryListNew.tsx"; // Use the new name
import AIMealGeneratorPage from "./pages/AIMealGeneratorPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx"; // Import ProtectedRoute

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/meals" element={<ProtectedRoute><MealsPage /></ProtectedRoute>} />
            <Route path="/discover-meals" element={<ProtectedRoute><DiscoverMealsPage /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
            <Route path="/planner" element={<ProtectedRoute><PlannerViewPage /></ProtectedRoute>} />
            <Route path="/grocery-list" element={<ProtectedRoute><GroceryListNew userId="placeholder" currentWeekStart={new Date()} /></ProtectedRoute>} /> {/* NOTE: userId and date here are placeholders, the component should ideally get these from context or props passed from a parent route/layout if not used directly on a page */}
            <Route path="/ai-meal" element={<ProtectedRoute><AIMealGeneratorPage /></ProtectedRoute>} />

            {/* Catch-all for 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;