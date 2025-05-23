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

  // onSubmit logic omitted for brevity

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 relative">
      <div className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center space-x-3">
        <Link to="/" className="text-2xl font-bold text-gray-800 dark:text-gray-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
          BitePath
        </Link>
        <ThemeToggleButton />
      </div>
      <Card 
        className="w-full max-w-md mt-16 md:mt-0"
        style={{
          // Force light card theme variables for this specific card,
          // ensuring SupabaseAuthUI (theme="light") has a light background.
          // @ts-ignore 
          '--card': 'hsl(0 0% 100%)', /* card background: white */
          // @ts-ignore 
          '--card-foreground': 'hsl(222.2 84% 4.9%)' /* card text: dark blue/black */
        } as React.CSSProperties}
      >
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
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: { // These variables apply to the 'default' (light) theme of ThemeSupa
                  colors: {
                    inputBackground: 'hsl(0 0% 100%)',   // White input background
                    inputText: 'hsl(0 0% 0%)',           // Black input text (on white input bg)
                    inputLabelText: 'hsl(0 0% 20%)',      // Dark gray label text (on white card bg)
                    inputPlaceholder: 'hsl(0 0% 40%)', // Medium gray placeholder (on white input bg)
                    // anchorTextColor: 'hsl(var(--primary))', // Optional: if links inside SupabaseUI need styling
                  },
                },
              },
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
            showLinks={false} // Keep this false to use custom toggle below
            theme="light" // This tells SupabaseAuthUI to use its 'light' appearance set
          />
          <div className="mt-6 text-center text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => navigate(`/auth${isLogin ? '?mode=signup' : ''}`, { replace: true })}
              className="text-blue-600 hover:underline" // Standard link color, should be visible on light card
              disabled={isLoading}
            >
              {isLogin ? "Sign Up" : "Login"}
            </button>
          </div>
        </CardContent>
      </Card>
      <Button variant="link" asChild className="mt-8 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
      </Button>
    </div>
  );
};

export default Auth;