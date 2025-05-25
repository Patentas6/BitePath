import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

// Temporarily only importing the problematic page with a new name
import GroceryListNew from "./pages/GroceryListNew.tsx"; // Importing the new file

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Temporarily only rendering the new component */}
            <Route path="/" element={<GroceryListNew userId="placeholder" currentWeekStart={new Date()} />} /> {/* Using the new component */}
            {/* Other routes are temporarily removed */}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;