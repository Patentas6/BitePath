import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Auth as SupabaseAuthUI } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useTheme } from "next-themes";

const authFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

type AuthFormValues = z.infer<typeof authFormSchema>;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false); // Keep isLoading state if needed elsewhere, but not used in this form
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: appTheme } = useTheme();

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    setIsLogin(queryParams.get('mode') !== 'signup');
    form.reset();
  }, [location.search, form]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/dashboard", { replace: true });
    };
    checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        showSuccess("Logged in successfully!");
        navigate("/dashboard", { replace: true });
      }
    });
    return () => authListener?.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 relative">
      <div className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center space-x-3">
        <Link to="/" className="text-2xl font-bold group">
          <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
          <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
        </Link>
        <ThemeToggleButton />
      </div>
      <Card className="w-full max-w-md mt-16 md:mt-0">
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
          {/* SupabaseAuthUI component is now the ONLY direct child of CardContent */}
          <SupabaseAuthUI
            supabaseClient={supabase}
            theme={appTheme === 'dark' ? 'dark' : 'light'}
            appearance={{
              theme: ThemeSupa,
              // Removed custom variables to simplify appearance
            }}
            providers={['google']}
            redirectTo={`${window.location.origin}/dashboard`}
            localization={{
              variables: {
                sign_in: { email_label: "Email address", password_label: "Password", button_label: "Sign in", social_provider_text: "Sign in with {{provider}}", link_text: "Already have an account? Sign in" },
                sign_up: { email_label: "Email address", password_label: "Password", button_label: "Sign up", social_provider_text: "Sign up with {{provider}}", link_text: "Don't have an account? Sign up" },
                forgotten_password: { email_label: "Email address", button_label: "Send reset instructions", link_text: "Forgot your password?" },
              },
            }}
            view={isLogin ? 'sign_in' : 'sign_up'}
            showLinks={false} // Hide default links as we provide our own below
          />
        </CardContent>
        {/* The toggle link div is now a sibling of CardContent */}
        <div className="mt-6 text-center text-sm px-6 pb-6"> {/* Added padding */}
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => navigate(`/auth${isLogin ? '?mode=signup' : ''}`, { replace: true })}
            className="text-blue-600 hover:underline"
            disabled={isLoading} // Use isLoading if applicable, though not currently tied to form submission state
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </div>
      </Card>
      {/* Custom toggle link placed outside the Card */}
      <div className="mt-8 text-center text-sm"> {/* Adjusted margin-top */}
        <Button variant="link" asChild className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default Auth;