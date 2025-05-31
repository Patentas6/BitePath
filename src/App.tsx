"use client";

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase } from './integrations/supabase/client';
import { SessionContextProvider, useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { AuthApiError } from '@supabase/supabase-js';

import IndexPage from './pages/Index';
import LoginPage from './pages/Login';
// import AddMealPage from './pages/AddMealPage'; // Temporarily commented out
import MyMealsPage from './pages/MyMealsPage';
import MealDetailPage from './pages/MealDetailPage';
import EditMealPage from './pages/EditMealPage';
import MealPlansPage from './pages/MealPlansPage';
import AddMealPlanPage from './pages/AddMealPlanPage';
import ViewMealPlanPage from './pages/ViewMealPlanPage';
import UserProfilePage from './pages/UserProfilePage';
import AdminPage from './pages/AdminPage';
import MealTemplatesPage from './pages/MealTemplatesPage';
import AddMealTemplatePage from './pages/AddMealTemplatePage';
import EditMealTemplatePage from './pages/EditMealTemplatePage';
import GenerateImagePage from './pages/GenerateImagePage';
import AiRecipeGeneratorPage from './pages/AiRecipeGeneratorPage';
import TourPage from './pages/TourPage';

import Navbar from './components/Navbar';
import ToastProvider from './components/ToastProvider'; // Ensure this is here
import { useToast } from './components/ui/use-toast';
import { Toaster } from "@/components/ui/toaster"; // Shadcn Toaster

interface Profile {
  id: string;
  is_admin?: boolean;
  has_completed_tour?: boolean;
}

const App: React.FC = () => {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <AppContent />
    </SessionContextProvider>
  );
};

const AppContent: React.FC = () => {
  const session = useSession();
  const supabaseClient = useSupabaseClient();
  const { toast } = useToast(); // For shadcn toast
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState<boolean | null>(null);
  const [loadingTourStatus, setLoadingTourStatus] = useState(true);
  const [authError, setAuthError] = useState<AuthApiError | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (session?.user) {
        try {
          const { data, error } = await supabaseClient
            .from('profiles')
            .select('is_admin, has_completed_tour')
            .eq('id', session.user.id)
            .single();

          if (error) throw error;
          if (data) {
            setIsAdmin(data.is_admin ?? false);
            setHasCompletedTour(data.has_completed_tour ?? false);
          } else {
            // Profile might not exist yet, or user just signed up
            setHasCompletedTour(false); // Assume new user hasn't completed tour
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          toast({ title: "Error", description: "Could not fetch user profile.", variant: "destructive" });
          setHasCompletedTour(false); // Default if error
        } finally {
          setLoadingTourStatus(false);
        }
      } else {
        setLoadingTourStatus(false); // No session, not loading tour status
        setHasCompletedTour(false); // No user, no tour completed
      }
    };

    fetchUserProfile();
  }, [session, supabaseClient, toast]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, session);
      if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
        const { error } = await supabase.auth.getSession(); // Refresh session
        if (error) {
          console.error("Error refreshing session:", error);
          setAuthError(error as AuthApiError);
          toast({ title: "Authentication Error", description: (error as AuthApiError).message, variant: "destructive" });
        } else {
          setAuthError(null);
        }
      }
      if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
        setHasCompletedTour(false);
        setAuthError(null);
      }
      // Re-fetch profile on auth change to ensure tour status is up-to-date
      if (session?.user) {
        setLoadingTourStatus(true);
        try {
          const { data, error } = await supabaseClient
            .from('profiles')
            .select('is_admin, has_completed_tour')
            .eq('id', session.user.id)
            .single();
          if (error && error.code !== 'PGRST116') { // PGRST116: 0 rows found, which is fine for new users
             console.error('Error fetching profile on auth change:', error);
          }
          if (data) {
            setIsAdmin(data.is_admin ?? false);
            setHasCompletedTour(data.has_completed_tour ?? false);
          } else {
            setHasCompletedTour(false);
          }
        } catch (e) {
          console.error('Catch fetching profile on auth change:', e);
        } finally {
          setLoadingTourStatus(false);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [supabaseClient, toast]);


  const ProtectedRoute: React.FC<{ adminOnly?: boolean }> = ({ adminOnly = false }) => {
    if (!session) {
      return <Navigate to="/login" replace />;
    }
    if (adminOnly && !isAdmin) {
      toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
      return <Navigate to="/" replace />;
    }
    if (loadingTourStatus) {
      return <div className="flex justify-center items-center h-screen"><p>Loading...</p></div>;
    }
    if (!hasCompletedTour && window.location.pathname !== '/tour') {
       // Check if already on tour page to prevent redirect loop
      return <Navigate to="/tour" replace />;
    }
    return <Outlet />;
  };

  // Inline component for testing the /add-meal route
  const TestAddMealPage = () => (
    <div style={{ padding: '20px', margin: '20px', backgroundColor: 'lime', border: '2px solid green' }}>
      <h2>THIS IS A TEST FROM APP.TSX FOR /add-meal</h2>
      <p>If you see this, the routing in App.tsx for /add-meal is working.</p>
    </div>
  );

  return (
    <Router>
      <ToastProvider /> {/* react-hot-toast provider */}
      {session && <Navbar />}
      <div className={session ? "pt-16" : ""}> {/* Add padding top if navbar is present */}
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" /> : <LoginPage />} />
          
          {/* Test route for /add-meal */}
          <Route path="/add-meal" element={<TestAddMealPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<IndexPage />} />
            {/* <Route path="/add-meal" element={<AddMealPage />} /> */} {/* Original route commented out */}
            <Route path="/my-meals" element={<MyMealsPage />} />
            <Route path="/meal/:id" element={<MealDetailPage />} />
            <Route path="/edit-meal/:id" element={<EditMealPage />} />
            <Route path="/meal-plans" element={<MealPlansPage />} />
            <Route path="/add-meal-plan" element={<AddMealPlanPage />} />
            <Route path="/meal-plan/:id" element={<ViewMealPlanPage />} />
            <Route path="/profile" element={<UserProfilePage />} />
            <Route path="/generate-image" element={<GenerateImagePage />} />
            <Route path="/ai-recipe-generator" element={<AiRecipeGeneratorPage />} />
            <Route path="/tour" element={<TourPage />} />
          </Route>
          <Route element={<ProtectedRoute adminOnly={true} />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/meal-templates" element={<MealTemplatesPage />} />
            <Route path="/add-meal-template" element={<AddMealTemplatePage />} />
            <Route path="/edit-meal-template/:id" element={<EditMealTemplatePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <Toaster /> {/* shadcn/ui Toaster */}
    </Router>
  );
};

export default App;