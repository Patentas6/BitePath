import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SessionContextProvider, useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { createClient } from '@supabase/supabase-js'; // Ensure this is the correct import for your Supabase client
import { useEffect, useState } from 'react';

import IndexPage from './pages/Index';
import LoginPage from './pages/Login';
import MealsPage from './pages/Meals';
import NewMealPage from './pages/NewMeal';
import MealDetailPage from './pages/MealDetail';
import MealPlansPage from './pages/MealPlans';
import NewMealPlanPage from './pages/NewMealPlan';
import ProfilePage from './pages/Profile';
import Layout from './components/Layout'; // Assuming you have a Layout component

// Initialize Supabase client
// Make sure your environment variables are correctly set up
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Check your .env file.");
}
// It's generally recommended to initialize the client once and export it,
// but for SessionContextProvider, you might pass it directly.
// If you have a central supabase client (e.g., src/integrations/supabase/client.ts), import it here.
// For now, creating it directly as SessionContextProvider might expect.
const supabase = createClient(supabaseUrl, supabaseAnonKey);


function AppRoutes() {
  const session = useSession();
  const isLoading = session === undefined; // Or use a specific loading state from useSession if available

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/" element={session ? <Layout><IndexPage /></Layout> : <Navigate to="/login" />} />
      <Route path="/meals" element={session ? <Layout><MealsPage /></Layout> : <Navigate to="/login" />} />
      <Route path="/meals/new" element={session ? <Layout><NewMealPage /></Layout> : <Navigate to="/login" />} />
      <Route path="/meals/:id" element={session ? <Layout><MealDetailPage /></Layout> : <Navigate to="/login" />} />
      <Route path="/plans" element={session ? <Layout><MealPlansPage /></Layout> : <Navigate to="/login" />} />
      <Route path="/plans/new" element={session ? <Layout><NewMealPlanPage /></Layout> : <Navigate to="/login" />} />
      <Route path="/profile" element={session ? <Layout><ProfilePage /></Layout> : <Navigate to="/login" />} />
      {/* Add other routes here */}
    </Routes>
  );
}

function App() {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <Router>
        <AppRoutes />
      </Router>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000, // Default duration for toasts
        }}
        containerStyle={{
          bottom: 80, // Adjust this value based on your bottom navigation bar's height + desired padding
          left: 20,
          right: 20,
        }}
      />
    </SessionContextProvider>
  );
}

export default App;