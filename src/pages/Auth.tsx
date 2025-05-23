import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, Link } from "react-router-dom";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Added CardDescription
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

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

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
        // You can add options here if needed, like data for user_metadata
        // options: {
        //   data: {
        //     first_name: 'Initial', // Example, ideally get this from form
        //     last_name: 'User',    // Example
        //   }
        // }
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
      // For sign up, user needs to confirm email, so no automatic redirect here
      // unless you change your Supabase auth settings (e.g., disable email confirmation).
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center"> {/* Centering header content */}
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
              <Button type="submit" className="w-full" disabled={isLoading}>
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
                setIsLogin(!isLogin);
                form.reset(); // Optionally reset form when toggling
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