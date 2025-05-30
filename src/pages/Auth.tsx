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
  const [isLoading, setIsLoading] = useState(false);
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
    const checkSessionAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', session.user.id)
          .single();
        
        if (profile && profile.first_name) {
          console.log('[Auth.tsx] checkSessionAndRedirect: Session exists, profile seems complete. Navigating to dashboard.');
          navigate("/dashboard", { replace: true });
        } else {
          console.log('[Auth.tsx] checkSessionAndRedirect: Session exists, profile might be incomplete. Navigating to profile.');
          navigate("/profile", { replace: true });
        }
      } else {
        console.log('[Auth.tsx] checkSessionAndRedirect: No active session.');
      }
    };
    checkSessionAndRedirect();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth.tsx] onAuthStateChange event:', event);
      if (event === "SIGNED_IN" && session) {
        showSuccess("Logged in successfully!");
        
        // Check profile completeness
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine for a new user
          console.error("[Auth.tsx] Error fetching profile on SIGNED_IN:", profileError);
          showError("Error checking profile. Please try again.");
          navigate("/dashboard", { replace: true, state: { justLoggedInForTour: true } }); // Fallback to dashboard
          return;
        }

        if (!profile || !profile.first_name) {
          console.log('[Auth.tsx] SIGNED_IN: Profile incomplete or not found. Navigating to /profile.');
          navigate("/profile", { replace: true });
        } else {
          console.log('[Auth.tsx] SIGNED_IN: Profile complete. Navigating to /dashboard with justLoggedInForTour: true state.');
          navigate("/dashboard", { replace: true, state: { justLoggedInForTour: true } });
        }
      }
    });
    return () => {
      console.log('[Auth.tsx] Unsubscribing auth listener.');
      authListener?.subscription.unsubscribe();
    };
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
            {isLogin ? "Login to Your Account" : (
              <>
                Join <span className="text-accent dark:text-foreground">Bite</span><span className="text-primary dark:text-primary">Path</span> Today!
              </>
            )}
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
            theme={appTheme === 'dark' ? 'dark' : 'light'}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: { 
                  colors: {
                    brand: 'hsl(var(--primary))', 
                    brandAccent: '#070500', 
                    inputBackground: 'hsl(var(--input))',
                    inputText: 'hsl(var(--foreground))',
                    inputLabelText: 'hsl(var(--foreground))',
                    inputPlaceholder: 'hsl(var(--muted-foreground))',
                  },
                },
                dark: { 
                  colors: {
                    brand: 'hsl(var(--primary))', 
                    brandAccent: 'hsl(var(--primary-foreground))', 
                    inputBackground: 'hsl(var(--input))',
                    inputText: 'hsl(var(--foreground))',
                    inputLabelText: 'hsl(var(--foreground))',
                    inputPlaceholder: 'hsl(var(--muted-foreground))',
                  },
                },
              },
            }}
            providers={['google']}
            localization={{
              variables: {
                sign_in: { email_label: "Email address", password_label: "Password", button_label: "Sign in", social_provider_text: "Sign in with {{provider}}", link_text: "Already have an account? Sign in" },
                sign_up: { email_label: "Email address", password_label: "Password", button_label: "Sign up", social_provider_text: "Sign up with {{provider}}", link_text: "Don't have an account? Sign up" },
                forgotten_password: { email_label: "Email address", button_label: "Send reset instructions", link_text: "Forgot your password?" },
              },
            }}
            view={isLogin ? 'sign_in' : 'sign_up'}
            showLinks={false}
          />
          <div className="mt-6 text-center text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => navigate(`/auth${isLogin ? '?mode=signup' : ''}`, { replace: true })}
              className="text-blue-600 hover:underline" 
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