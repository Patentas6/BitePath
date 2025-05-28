import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch"; // Added Switch
import { useNavigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { Textarea } from "@/components/ui/textarea";
import { LogOut } from "lucide-react"; 
import { useIsMobile } from "@/hooks/use-mobile"; // Import useIsMobile
import AppHeader from "@/components/AppHeader"; // Import AppHeader for desktop
import { cn } from "@/lib/utils";

const profileFormSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters."),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters."),
  ai_preferences: z.string().optional(),
  preferred_unit_system: z.enum(["imperial", "metric"]).default("imperial"),
  track_calories: z.boolean().default(false).optional(), // Added track_calories
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  ai_preferences: string | null;
  preferred_unit_system: "imperial" | "metric" | null;
  track_calories: boolean | null; // Added track_calories
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const isMobile = useIsMobile(); // Initialize useIsMobile

  useEffect(() => {
    // ProtectedRoute should ensure a session exists.
    // This effect primarily sets local state and handles SIGNED_OUT.
    const initializeUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.id);
      } else {
        // If ProtectedRoute somehow failed or this page was accessed directly without auth
        // This is a fallback.
        console.warn("[ProfilePage] No user session found, redirecting to auth.");
        navigate("/auth", { replace: true });
      }
    };

    initializeUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setUserId(null);
        navigate("/auth", { replace: true });
      } else if (session?.user) {
        setUser(session.user);
        setUserId(session.user.id);
      } else if (!session?.user && event !== 'INITIAL_SESSION') {
        // If session becomes null for other reasons (e.g. token revoked)
        setUser(null);
        setUserId(null);
        navigate("/auth", { replace: true });
      }
    });
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { 
      first_name: "", 
      last_name: "", 
      ai_preferences: "", 
      preferred_unit_system: "imperial",
      track_calories: false, // Added default
    },
  });

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<ProfileData | null>({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, ai_preferences, preferred_unit_system, track_calories") // Added track_calories
        .eq("id", userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userId, // Query will only run if userId is set
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        ai_preferences: profile.ai_preferences || "",
        preferred_unit_system: profile.preferred_unit_system || "imperial",
        track_calories: profile.track_calories || false, // Added track_calories
      });
    } else if (!isLoadingProfile && userId) {
      // If there's a userId but no profile data (e.g., new user), reset with defaults
      form.reset({ 
        first_name: "", 
        last_name: "", 
        ai_preferences: "", 
        preferred_unit_system: "imperial",
        track_calories: false, 
      });
    }
  }, [profile, isLoadingProfile, userId, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!userId) throw new Error("User not authenticated.");
      const updateData = {
        id: userId,
        first_name: values.first_name,
        last_name: values.last_name,
        ai_preferences: values.ai_preferences,
        preferred_unit_system: values.preferred_unit_system,
        track_calories: values.track_calories, // Added track_calories
      };
      const { data, error } = await supabase.from("profiles").upsert(updateData).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { 
      showSuccess("Profile updated successfully!"); 
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] }); 
      queryClient.invalidateQueries({ queryKey: ["userProfileForGenerationLimits"] });
      queryClient.invalidateQueries({ queryKey: ["userProfileForAddMealLimits"] });
      queryClient.invalidateQueries({ queryKey: ["userProfileForGrocery"] });
      queryClient.invalidateQueries({ queryKey: ["userProfileDataForHeader"] });
      queryClient.invalidateQueries({ queryKey: ["groceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysGroceryListSource"] });
      navigate("/dashboard"); 
    },
    onError: (error: Error) => { showError(`Failed to update profile: ${error.message}`); },
  });

  const onSubmit = (values: ProfileFormValues) => updateProfileMutation.mutate(values);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(`Logout failed: ${error.message}`);
    } else {
      showSuccess("Logged out successfully.");
      // Navigation to /auth is handled by onAuthStateChange listener or ProtectedRoute
    }
  };

  // Render loading state while userId is being determined or profile is loading
  if (!userId || (isLoadingProfile && !profile)) { 
     return <div className="min-h-screen flex items-center justify-center">Loading profile...</div>;
  }
  if (profileError) return <div>Error loading profile. Please try refreshing.</div>;


  return (
    <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
      <AppHeader /> {/* Renders bottom nav on mobile, full header on desktop */}
      
      {/* Page specific header for mobile (logo + theme toggle) */}
      {isMobile && (
        <header className="flex justify-between items-center mb-6">
          <Link to="/dashboard" className="text-2xl font-bold group">
            <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
            <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
          </Link>
          <ThemeToggleButton />
        </header>
      )}
      
      <div className={cn("flex flex-col items-center", !isMobile && "container mx-auto")}>
        {!isMobile && ( /* Desktop header is handled by AppHeader, this is for page title */
          <header className="w-full mb-6 flex justify-between items-center">
             {/* Desktop doesn't need BitePath logo here as AppHeader shows it */}
          </header>
        )}
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <ShadcnCardDescription>Update your display name, AI preferences, and other settings. Saving will take you to the home screen.</ShadcnCardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input placeholder="e.g., Captain Cook" {...field} disabled={updateProfileMutation.isPending || isLoadingProfile} /></FormControl>
                      <FormDescription>This can be your real name or something fun!</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input placeholder="e.g., The Magnificent" {...field} disabled={updateProfileMutation.isPending || isLoadingProfile} /></FormControl>
                      <FormDescription>Your surname, a cool title, or leave it blank!</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ai_preferences"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Meal Preferences</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., 'lactose intolerant', 'prefer vegetarian options', 'avoid nuts'"
                          {...field}
                          disabled={updateProfileMutation.isPending || isLoadingProfile}
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        Tell the AI about your dietary needs, allergies, or general preferences for meal generation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferred_unit_system"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Preferred Unit System</FormLabel>
                      <FormDescription>
                        Select the unit system for AI meal generation and grocery list display.
                        Note: tsp, tbsp, and cup units are generally retained as-is in both systems for cooking convenience.
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value} 
                          className="flex flex-col space-y-1"
                          disabled={updateProfileMutation.isPending || isLoadingProfile}
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="imperial" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Imperial (e.g., lb, oz)
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="metric" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Metric (e.g., kg, g, L, ml)
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="track_calories"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Track Calories
                        </FormLabel>
                        <FormDescription>
                          Enable to have AI estimate calories for generated meals and display them in your plans.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateProfileMutation.isPending || isLoadingProfile}
                          className="data-[state=unchecked]:border-slate-400 dark:data-[state=unchecked]:border-slate-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-2 pt-2">
                  <Button 
                    type="submit" 
                    disabled={!userId || updateProfileMutation.isPending || isLoadingProfile} 
                    className="w-full sm:flex-grow"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes & Go to Home"}
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleLogout} 
                    disabled={updateProfileMutation.isPending}
                    className="w-full sm:w-auto"
                    type="button" 
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;