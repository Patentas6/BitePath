import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Auth as SupabaseAuthUI } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// Define validation schema for email/password auth forms
const authFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

type AuthFormValues = z.infer<typeof authFormSchema>;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get('mode') === 'signup') {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
    form.reset();
  }, [location.search, form]);

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    };
    checkSession();

    // Listen for successful sign-in (including SSO)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        showSuccess("Logged in successfully!");
        navigate("/dashboard", { replace: true });
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);


  const onSubmit = async (values: AuthFormValues) => {
    setIsLoading(true);
    const { email, password } = values;
    let error = null;

    if (isLogin) {
      console.log("Attempting login...");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      error = signInError;
      // Success navigation is handled by onAuthStateChange
    } else {
      console.log("Attempting sign up...");
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // Supabase handles email confirmation for password sign-ups by default
      });
      error = signUpError;
      if (!error) {
        showSuccess("Sign up successful! Please check your email to confirm.");
        // User stays on page to see message, or you can redirect to a "check email" page
      }
    }

    setIsLoading(false);

    if (error) {
      console.error("Auth error:", error);
      showError(error.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Login to Your Account" : "Join BitePath Today!"}
          </CardTitle>
          {!isLogin && (
            <CardDescription className="pt-2">
              Create your account to start planning meals and simplifying your week.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <SupabaseAuthUI
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google']} // <-- Added Google here
            redirectTo={window.location.origin + "/dashboard"} // Redirect after successful SSO
            localization={{
              variables: {
                sign_in: {
                  email_label: "Email address",
                  password_label: "Password",
                  button_label: "Sign in",
                  social_provider_text: "Sign in with {{provider}}",
                  link_text: "Already have an account? Sign in",
                },
                sign_up: {
                  email_label: "Email address",
                  password_label: "Password",
                  button_label: "Sign up",
                  social_provider_text: "Sign up with {{provider}}",
                  link_text: "Don't have an account? Sign up",
                },
                forgotten_password: {
                  email_label: "Email address",
                  button_label: "Send reset instructions",
                  link_text: "Forgot your password?",
                },
              },
            }}
            view={isLogin ? 'sign_in' : 'sign_up'}
            showLinks={false} // We handle the toggle link manually
            theme="light" // Or "dark" if you have a dark theme
          />

          {/* Manual Email/Password form for more control if needed, or can be removed if AuthUI is sufficient */}
          {/* For now, let's keep the AuthUI as the primary method and hide the manual form if SSO is the focus */}
          {/* If you want to keep both, you'd structure this differently */}
          
          <div className="mt-6 text-center text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                const newMode = isLogin ? 'signup' : 'login';
                navigate(`/auth${newMode === 'signup' ? '?mode=signup' : ''}`, { replace: true });
              }}
              className="text-blue-600 hover:underline"
              disabled={isLoading}
            >
              {isLogin ? "Sign Up" : "Login"}
            </button>
          </div>
        </CardContent>
      </Card>
      <Button variant="link" asChild className="mt-8 text-gray-600 hover:text-gray-800">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
      </Button>
    </div>
  );
};

export default Auth;