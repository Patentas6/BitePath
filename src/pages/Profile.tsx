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
import { useNavigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import WeeklyPlanner from "@/components/WeeklyPlanner"; // Import WeeklyPlanner
import { startOfWeek, addDays } from "date-fns"; // Import date-fns for WeeklyPlanner state
import { BookOpenText, Brain, SquarePen, CalendarDays } from "lucide-react"; // Import icons

const profileFormSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters."),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters."),
  ai_preferences: z.string().optional(), // Added AI preferences field
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  ai_preferences: string | null; // Added AI preferences field
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 })); // State for WeeklyPlanner

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
    defaultValues: { first_name: "", last_name: "", ai_preferences: "" }, // Set default value
  });

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<ProfileData | null>({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("profiles").select("id, first_name, last_name, ai_preferences").eq("id", userId).single(); // Select new field
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile) form.reset({ first_name: profile.first_name || "", last_name: profile.last_name || "", ai_preferences: profile.ai_preferences || "" }); // Populate new field
    else if (!isLoadingProfile && userId) form.reset({ first_name: "", last_name: "", ai_preferences: "" }); // Reset new field
  }, [profile, isLoadingProfile, userId, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from("profiles").upsert({ id: userId, ...values }).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { showSuccess("Profile updated!"); queryClient.invalidateQueries({ queryKey: ["userProfile", userId] }); },
    onError: (error: Error) => { showError(`Failed to update profile: ${error.message}`); },
  });

  const onSubmit = (values: ProfileFormValues) => updateProfileMutation.mutate(values);

  // Handler for WeeklyPlanner navigation
  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prev => addDays(prev, direction === "next" ? 7 : -7));
  };


  if (!userId && !user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (profileError) return <div>Error loading profile.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <header className="container mx-auto mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Link to="/" className="text-2xl font-bold group">
            <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
            <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
          </Link>
          <ThemeToggleButton />
        </div>
         <div className="flex items-center space-x-2">
            {/* Navigation Links in new order */}
            <Button variant="default" size="sm" asChild>
              <Link to="/meals"><BookOpenText className="mr-2 h-4 w-4" /> My Meals</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/generate-meal"><Brain className="mr-2 h-4 w-4" /> Generate Meal</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/add-meal"><SquarePen className="mr-2 h-4 w-4" /> Add Own Meal</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/profile"><CalendarDays className="mr-2 h-4 w-4" /> Weekly Plan</Link> {/* Link to Profile page */}
            </Button>
            {/* Profile link removed from main nav */}
            <Button onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }} variant="destructive" size="sm">Logout</Button>
          </div>
      </header>
      <div className="container mx-auto flex flex-col lg:flex-row gap-6"> {/* Flex container for layout */}
        {/* Left side: Weekly Planner */}
        <div className="lg:w-2/3"> {/* Takes 2/3 width on large screens */}
          {userId && <WeeklyPlanner userId={userId} currentWeekStart={currentWeekStart} onWeekNavigate={handleWeekNavigate} />}
        </div>
        {/* Right side: Profile Form */}
        <div className="lg:w-1/3"> {/* Takes 1/3 width on large screens */}
           <Card className="hover:shadow-lg transition-shadow duration-200"> {/* Wrap form in Card */}
             <CardHeader>
               <CardTitle>Your Profile</CardTitle>
               <ShadcnCardDescription>Update your display name and AI preferences.</ShadcnCardDescription>
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
                    {/* New AI Preferences Field */}
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
                             rows={4} // Adjust rows as needed
                           />
                         </FormControl>
                         <FormDescription>
                           Tell the AI about your dietary needs, allergies, or general preferences for meal generation.
                         </FormDescription>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                   <div className="flex space-x-2 justify-end">
                     {/* Removed Back to Dashboard button */}
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
    </div>
  );
};

export default ProfilePage;