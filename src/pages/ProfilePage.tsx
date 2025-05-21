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
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const profileFormSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const ProfilePage = () => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUserId = async () => {
      console.log("ProfilePage: Attempting to get user ID");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log("ProfilePage: User ID found:", user.id);
        setUserId(user.id);
      } else {
        console.log("ProfilePage: No user found by supabase.auth.getUser() in ProfilePage.");
      }
    };
    getUserId();
  }, []);

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<ProfileData | null>({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      if (!userId) {
        console.log("ProfilePage: Query not run because userId is null.");
        return null;
      }
      console.log("ProfilePage: Fetching profile for userId:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("id", userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { 
        console.error("ProfilePage: Error fetching profile:", error);
        throw error;
      }
      console.log("ProfilePage: Profile data fetched (or null if not found):", data);
      return data;
    },
    enabled: !!userId,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
    },
  });

  useEffect(() => {
    if (profile) {
      console.log("ProfilePage: Resetting form with profile data:", profile);
      form.reset({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
      });
    } else if (!isLoadingProfile && userId) { 
      console.log("ProfilePage: Profile data is null (and not loading, user ID available), resetting form with empty strings.");
      form.reset({
        first_name: "",
        last_name: "",
      });
    }
  }, [profile, isLoadingProfile, userId, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("ProfilePage: Attempting to upsert profile for userId:", userId, "with values:", values);
      
      const { data: upsertedData, error } = await supabase
        .from("profiles")
        .upsert({
          id: userId, 
          first_name: values.first_name,
          last_name: values.last_name,
        })
        .select(); // Add .select() to get the upserted data back

      console.log("ProfilePage: Upsert operation completed. Returned data:", upsertedData, "Error:", error);

      if (error) {
        console.error("ProfilePage: Error during upsert operation:", error);
        throw error;
      }
      if (!upsertedData || upsertedData.length === 0) {
        // This case would be strange if no error was thrown but no data returned.
        console.warn("ProfilePage: Upsert returned no data and no error.");
      }
      // No explicit "Profile upsert successful" here, success is implied if no error thrown
    },
    onSuccess: (data, variables) => { // data here is what mutationFn returns (undefined if not returned)
      showSuccess("Profile updated successfully!");
      console.log("ProfilePage: Mutation onSuccess triggered. Variables:", variables);
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
    },
    onError: (error) => {
      showError(`Failed to update profile: ${error.message}`);
      console.error("ProfilePage: Mutation onError triggered:", error);
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  if (!userId && isLoadingProfile) { 
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <p>Loading user information...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <Button variant="outline" asChild className="self-start">
          <Link to="/dashboard">← Back to Dashboard</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>
              Update your display names. They don't have to be your <em>real</em> names – get creative with your meal planning persona! Just make sure you remember what you pick.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProfile && !profile && (
              <div className="space-y-4">
                <p>Loading profile data...</p>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/4" />
              </div>
            )}
            {profileError && (
              <p className="text-red-500">Error loading profile: {(profileError as Error).message}</p>
            )}
            {(!isLoadingProfile || profile) && !profileError && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name / Alias</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Captain Cook" {...field} />
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
                        <FormLabel>Last Name / Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., The Magnificent" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;