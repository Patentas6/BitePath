"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const supabaseClient = useSupabaseClient();
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      // If user is already logged in, redirect to the home page.
      // App.tsx routing also handles this, but this is an additional safeguard.
      navigate('/');
    }
  }, [session, navigate]);

  if (!supabaseClient) {
    // This should ideally not happen if SessionContextProvider is set up correctly in App.tsx
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading Supabase client...</p>
      </div>
    );
  }
  
  // If a session exists, the useEffect above will trigger navigation.
  // Otherwise, show the login form.
  if (session) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-500">
            BitePath
          </CardTitle>
          <CardDescription className="text-md text-gray-600 pt-1">
            Sign in to plan your meals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabaseClient}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(217, 91%, 60%)', // Example: Tailwind's blue-600
                    brandAccent: 'hsl(217, 91%, 50%)',
                  },
                  radii: {
                    borderRadiusButton: '0.5rem', // Corresponds to rounded-md
                    buttonBorderRadius: '0.5rem',
                    inputBorderRadius: '0.5rem',
                  }
                }
              }
            }}
            providers={[]} // Add social providers here, e.g., ['google', 'github']
            theme="light" // Can be "dark" or "light"
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email address',
                  password_label: 'Password',
                  button_label: 'Sign in',
                  link_text: "Don't have an account? Sign up",
                },
                sign_up: {
                  email_label: 'Email address',
                  password_label: 'Create a password',
                  button_label: 'Sign up',
                  link_text: 'Already have an account? Sign in',
                },
                forgotten_password: {
                  email_label: 'Email address',
                  button_label: 'Send reset instructions',
                  link_text: 'Forgot your password?',
                }
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}