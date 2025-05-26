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
import { useNavigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { Textarea } from "@/components/ui/textarea";

const profileFormSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters."),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters."),
  ai_preferences: z.string().optional(),
  preferred_unit_system: z.enum(["imperial", "metric"]).default("imperial"),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  ai_preferences: string | null;
  preferred_unit_system: "imperial" | "metric" | null;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getSessionAndUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) { setUser(session.user); setUserId(session.user.id); }
      else { navigate("/auth"); }
    };
    getSessionAndUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) { setUser(null); setUserId(null); navigate("/auth"); }
      else if (session?.user) { setUser(session.user); setUserId(session.user.id); }
    });
    return () => authListener?.subscription.unsubscribe();
  }, [navigate]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { first_name: "", last_name: "", ai_preferences: "", preferred_unit_system: "imperial" },
  });

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<ProfileData | null>({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("profiles").select("id, first_name, last_name, ai_preferences, preferred_unit_system").eq("id", userId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        ai_preferences: profile.ai_preferences || "",
        preferred_unit_system: profile.preferred_unit_system || "imperial",
      });
    } else if (!isLoadingProfile && userId) {
      form.reset({ first_name: "", last_name: "", ai_preferences: "", preferred_unit_system: "imperial" });
    }
  }, [profile, isLoadingProfile, userId, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from("profiles").upsert({ id: userId, ...values }).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { 
      showSuccess("Profile updated!"); 
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] }); 
      // Invalidate other queries that might depend on unit system preference
      queryClient.invalidateQueries({ queryKey: ["userProfileForGenerationLimits"] });
      queryClient.invalidateQueries({ queryKey: ["userProfileForAddMealLimits"] });
      queryClient.invalidateQueries({ queryKey: ["groceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysGroceryListSource"] });
    },
    onError: (error: Error) => { showError(`Failed to update profile: ${error.message}`); },
  });

  const onSubmit = (values: ProfileFormValues) => updateProfileMutation.mutate(values);

  if (!userId && !user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (profileError) return <div>Error loading profile.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <header className="container mx-auto mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Link to="/dashboard" className="text-2xl font-bold group">
            <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
            <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
          </Link>
          <ThemeToggleButton />
        </div>
      </header>
      <div className="flex flex-col items-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <ShadcnCardDescription>Update your display name, AI preferences, and unit system.</ShadcnCardDescription>
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
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                          disabled={updateProfileMutation.isPending || isLoadingProfile}
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="imperial" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Imperial (e.g., lb, oz, cup)
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
                <div className="flex space-x-2 justify-end">
                  <Button variant="outline" onClick={() => navigate("/dashboard")} disabled={updateProfileMutation.isPending}>
                    Back to Dashboard
                  </Button>
                  <Button type="submit" disabled={!userId || updateProfileMutation.isPending || isLoadingProfile}>
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
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