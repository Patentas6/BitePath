import { useState, useEffect } from "react"; // Added useEffect
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, Link, useLocation } from "react-router-dom"; // Added useLocation
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

// Define validation schema for auth forms
const authFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

type AuthFormValues = z.infer<typeof authFormSchema>;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true); 
  const [isLoading, setIsLoading] = useState(false); 
  const navigate = useNavigate(); 
  const location = useLocation(); // Get location object

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
      setIsLogin(true); // Default to login if no mode or different mode
    }
    form.reset(); // Reset form when mode is determined or changes
  }, [location.search, form]);

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
      if (!error) {
        showSuccess("Logged in successfully!");
      }
    } else {
      console.log("Attempting sign up...");
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      error = signUpError;
      if (!error) {
        showSuccess("Sign up successful! Please check your email to confirm.");
      }
    }

    setIsLoading(false);

    if (error) {
      console.error("Auth error:", error);
      showError(error.message);
    } else {
      if (isLogin) {
         navigate("/dashboard"); 
      }
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className={`w-full ${!isLogin ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}`} 
                disabled={isLoading}
              >
                {isLoading 
                  ? (isLogin ? "Logging In..." : "Creating Account...") 
                  : (isLogin ? "Login" : "Create Account")}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                // When toggling, navigate to update URL and trigger useEffect
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