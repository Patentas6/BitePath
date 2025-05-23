import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useNavigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

const profileFormSchema = z.object({
  first_name: z.string().min(1, { message: "First name is required." }).max(50, { message: "First name cannot exceed 50 characters." }),
  last_name: z.string().min(1, { message: "Last name is required." }).max(50, { message: "Last name cannot exceed 50 characters." }),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const ProfilePage = () => {
  console.log("[PROFILE_PAGE_RENDER] Component rendering or re-rendering.");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    console.log("[PROFILE_EFFECT_SESSION] Running effect to get session and user ID.");
    const getSessionAndUser = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[PROFILE_EFFECT_SESSION] Error getting session:", sessionError);
        showError("Error getting user session. Redirecting to login.");
        navigate("/auth");
        return;
      }
      if (session?.user) {
        console.log("[PROFILE_EFFECT_SESSION] Session found. User ID:", session.user.id);
        setUser(session.user);
        setUserId(session.user.id);
      } else {
        console.log("[PROFILE_EFFECT_SESSION] No session found, navigating to auth.");
        navigate("/auth");
      }
    };
    getSessionAndUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[PROFILE_AUTH_LISTENER] Auth state changed:", event);
      if (event === "SIGNED_OUT" || !session?.user) {
        console.log("[PROFILE_AUTH_LISTENER] User signed out or no session, navigating to auth.");
        setUser(null);
        setUserId(null);
        navigate("/auth");
      } else if (session?.user) {
        console.log("[PROFILE_AUTH_LISTENER] User session updated. User ID:", session.user.id);
        setUser(session.user);
        setUserId(session.user.id);
      }
    });

    return () => {
      console.log("[PROFILE_EFFECT_SESSION] Cleaning up auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
    },
  });

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<ProfileData | null>({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      if (!userId) {
        console.log("[PROFILE_QUERY_FN] No userId, returning null.");
        return null;
      }
      console.log(`[PROFILE_QUERY_FN] Fetching profile for userId: ${userId}`);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("id", userId)
        .single();

      if (error) {
        console.error(`[PROFILE_QUERY_FN] Supabase error for userId ${userId}:`, error);
        if (error.code === 'PGRST116') { 
          console.warn(`[PROFILE_QUERY_FN] Profile not found for userId ${userId} (PGRST116). This is normal for new users.`);
          return null; 
        }
        throw error; 
      }
      console.log(`[PROFILE_QUERY_FN] Profile data fetched for userId ${userId}:`, data);
      return data;
    },
    enabled: !!userId, 
  });
  
  useEffect(() => {
    console.log("[PROFILE_EFFECT_FORM_RESET] Running effect to reset form. Profile:", profile, "isLoadingProfile:", isLoadingProfile, "userId:", userId);
    if (profile) {
      console.log("[PROFILE_EFFECT_FORM_RESET] Profile data exists, resetting form with:", { first_name: profile.first_name || "", last_name: profile.last_name || "" });
      form.reset({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
      });
    } else if (!isLoadingProfile && userId) {
      console.log("[PROFILE_EFFECT_FORM_RESET] Profile data is null, not loading, userId exists. Resetting form to empty.");
      form.reset({ first_name: "", last_name: "" });
    }
  }, [profile, isLoadingProfile, userId, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!userId) {
        console.error("[PROFILE_MUTATION_FN_ERROR] No userId, cannot update profile.");
        throw new Error("User not authenticated. Cannot update profile.");
      }
      console.log(`[PROFILE_MUTATION_FN_START] Attempting to upsert for userId: ${userId} with values:`, values);
      
      const response = await supabase
        .from("profiles")
        .upsert({
          id: userId, 
          first_name: values.first_name,
          last_name: values.last_name,
        })
        .select(); 

      console.log("[PROFILE_MUTATION_FN_RESPONSE] Supabase upsert().select() response:", response);

      if (response.error) {
        console.error("[PROFILE_MUTATION_FN_ERROR] Error from Supabase during upsert:", response.error);
        throw response.error;
      }
      if (!response.data || response.data.length === 0) {
        console.warn("[PROFILE_MUTATION_FN_WARN] Upsert successful but no data returned from .select(). This might indicate an RLS issue on select or an unexpected Supabase behavior.");
      }
      return response.data;
    },
    onSuccess: (data) => {
      console.log("[PROFILE_ON_SUCCESS] Mutation succeeded. Data:", data, "Invalidating userProfile query for userId:", userId);
      showSuccess("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
    },
    onError: (error) => {
      console.error("[PROFILE_ON_ERROR] Mutation failed:", error);
      showError(`Failed to update profile: ${error.message}`);
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    console.log("[PROFILE_ON_SUBMIT] Form submitted with values:", values);
    updateProfileMutation.mutate(values);
  };

  if (!userId && !user) {
    console.log("[PROFILE_RENDER_GUARD] No userId and no user, rendering loading/redirect state.");
    return <div className="min-h-screen flex items-center justify-center">Loading user information...</div>;
  }
  
  if (profileError) {
    console.error("[PROFILE_RENDER_ERROR] Error rendering profile page due to profileError:", profileError);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-red-500">Could not load profile data: {profileError.message}</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="container mx-auto mb-6 flex justify-between items-center">
        <Link to="/dashboard" className="text-2xl font-bold text-gray-800 hover:text-teal-600 transition-colors">
          BitePath
        </Link>
        {/* You can add other header elements here if needed, like a page title or back button */}
      </header>
      <div className="flex flex-col items-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Update your first and last name.</CardDescription>
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
                      <FormControl>
                        <Input placeholder="Your first name" {...field} disabled={updateProfileMutation.isPending || isLoadingProfile} />
                      </FormControl>
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
                      <FormControl>
                        <Input placeholder="Your last name" {...field} disabled={updateProfileMutation.isPending || isLoadingProfile} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex space-x-2 justify-end">
                  <Button variant="outline" onClick={() => navigate("/dashboard")} disabled={updateProfileMutation.isPending}>
                    Back
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