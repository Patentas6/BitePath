import MealForm, { GenerationStatusInfo } from "@/components/MealForm"; // Import GenerationStatusInfo
import AppHeader from "@/components/AppHeader";
import { useState, useEffect, useMemo } from 'react'; // Import hooks
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import { supabase } from '@/lib/supabase'; // Import supabase
import { format as formatDateFns } from "date-fns"; // Import date-fns
import { IMAGE_GENERATION_LIMIT_PER_MONTH } from '@/lib/constants'; // Import constant

interface UserProfileData {
  is_admin: boolean;
  image_generation_count: number;
  last_image_generation_reset: string | null;
  track_calories?: boolean; // Added track_calories
}

const AddMealPage = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    };
    fetchUser();
  }, []);

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery<UserProfileData | null>({
    queryKey: ['userProfileForAddMealLimits', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, image_generation_count, last_image_generation_reset, track_calories') // Added track_calories
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile for add meal page:", error);
        throw error;
      }
      return data;
    },
    enabled: !!userId,
  });

  const generationStatus = useMemo((): GenerationStatusInfo => {
    if (!userProfile) return { generationsUsedThisMonth: 0, limitReached: true, isAdmin: false };
    if (userProfile.is_admin) return { generationsUsedThisMonth: 0, limitReached: false, isAdmin: true };

    const currentMonthYear = formatDateFns(new Date(), "yyyy-MM");
    let generationsUsedThisMonth = userProfile.image_generation_count || 0;

    if (userProfile.last_image_generation_reset !== currentMonthYear) {
      generationsUsedThisMonth = 0;
    }
    
    return { 
      generationsUsedThisMonth,
      limitReached: generationsUsedThisMonth >= IMAGE_GENERATION_LIMIT_PER_MONTH,
      isAdmin: false
    };
  }, [userProfile]);

  const shouldShowCalorieField = useMemo(() => {
    if (isLoadingProfile) return false; // Don't show if profile is loading
    return userProfile?.track_calories || false;
  }, [userProfile, isLoadingProfile]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <AppHeader />
        <div className="flex justify-center items-center mb-0">
            <h1 className="text-xl sm:text-3xl font-bold">Add New Meal</h1>
        </div>
        <div className="space-y-6">
          <MealForm 
            generationStatus={generationStatus} 
            isLoadingProfile={isLoadingProfile} 
            showCaloriesField={shouldShowCalorieField} 
          />
        </div>
      </div>
    </div>
  );
};

export default AddMealPage;