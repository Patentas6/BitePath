import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format as formatDateFns, startOfWeek, addDays } from "date-fns";
import { IMAGE_GENERATION_LIMIT_PER_MONTH, RECIPE_GENERATION_LIMIT_PER_PERIOD, RECIPE_GENERATION_PERIOD_DAYS } from '@/lib/constants';
import { useIsMobile } from "@/hooks/use-is-mobile"; // Corrected import path
import { cn } from "@/lib/utils";

import AppHeader from "@/components/AppHeader";
import MealForm, { GenerationStatusInfo as MealFormGenerationStatus, MealFormValues } from "@/components/MealForm";
import GenerateMealFlow, { GeneratedMeal } from "@/components/GenerateMealFlow"; 
import WeeklyPlanner from "@/components/WeeklyPlanner"; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; 
import { Button } from '@/components/ui/button'; 
import { PlusCircle, Brain, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'; 

interface UserProfileDataForLimits {
  is_admin: boolean;
  image_generation_count: number;
  last_image_generation_reset: string | null; 
  recipe_generation_count: number | null;
  last_recipe_generation_reset: string | null; 
  track_calories?: boolean;
  ai_preferences?: string | null;
}

export interface CombinedGenerationLimits {
  image: MealFormGenerationStatus; 
  recipe: { 
    generationsUsedThisPeriod: number;
    limitReached: boolean;
    daysRemainingInPeriod: number;
    periodResetsToday: boolean;
    isAdmin: boolean;
  };
  showCaloriesField: boolean;
  isLoadingProfile: boolean;
}

// Define types for GenerateMealFlow state to be lifted
interface GenerateMealSelections {
  selectedMealType: string | undefined;
  selectedKinds: string[];
  selectedStyles: string[];
  ingredientPreferences: string;
  refinementPrompt: string;
}

const ManageMealEntryPage = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'add'>('generate');
  const isMobile = useIsMobile();
  
  const [showPostSavePlanner, setShowPostSavePlanner] = useState(false);
  const [newlySavedMealInfo, setNewlySavedMealInfo] = useState<{id: string, name: string} | null>(null);
  const [plannerWeekStart, setPlannerWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // State lifted from GenerateMealFlow
  const [generateMealSelections, setGenerateMealSelections] = useState<GenerateMealSelections>({
    selectedMealType: undefined,
    selectedKinds: [],
    selectedStyles: [],
    ingredientPreferences: '',
    refinementPrompt: '',
  });
  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(null);

  // State for MealForm (manual entry / editing generated)
  // This will hold the data for MealForm, whether it's from a generated meal or typed manually
  const [currentMealFormData, setCurrentMealFormData] = useState<MealFormValues | null>(null);


  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    };
    fetchUser();
  }, []);

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery<UserProfileDataForLimits | null>({
    queryKey: ['userProfileForMealEntryLimits', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, image_generation_count, last_image_generation_reset, recipe_generation_count, last_recipe_generation_reset, track_calories, ai_preferences')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data;
    },
    enabled: !!userId,
  });

  const combinedGenerationLimits = useMemo((): CombinedGenerationLimits => {
    const defaultImageStatus: MealFormGenerationStatus = { generationsUsedThisMonth: 0, limitReached: true, isAdmin: false };
    const defaultRecipeStatus = {
      generationsUsedThisPeriod: 0,
      limitReached: true,
      daysRemainingInPeriod: RECIPE_GENERATION_PERIOD_DAYS,
      periodResetsToday: false,
      isAdmin: false
    };

    if (!userProfile) {
      return { 
        image: defaultImageStatus, 
        recipe: defaultRecipeStatus,
        showCaloriesField: false,
        isLoadingProfile: isLoadingProfile 
      };
    }
    const isAdmin = userProfile.is_admin || false;
    const currentMonthYear = formatDateFns(new Date(), "yyyy-MM");
    let imgGenerationsUsed = userProfile.image_generation_count || 0;
    if (userProfile.last_image_generation_reset !== currentMonthYear) {
      imgGenerationsUsed = 0;
    }
    const imageStatus: MealFormGenerationStatus = {
      generationsUsedThisMonth: imgGenerationsUsed,
      limitReached: !isAdmin && (imgGenerationsUsed >= IMAGE_GENERATION_LIMIT_PER_MONTH),
      isAdmin: isAdmin
    };
    const today = new Date();
    let recipeGenerationsUsed = userProfile.recipe_generation_count || 0;
    let daysRemaining = RECIPE_GENERATION_PERIOD_DAYS;
    let recipePeriodResetsToday = false;
    if (userProfile.last_recipe_generation_reset) {
      try {
        const lastResetDate = formatDateFns(new Date(userProfile.last_recipe_generation_reset), "yyyy-MM-dd");
        const diffInDays = Math.floor((today.getTime() - new Date(lastResetDate).getTime()) / (1000 * 3600 * 24));
        if (diffInDays >= RECIPE_GENERATION_PERIOD_DAYS) {
          recipeGenerationsUsed = 0;
          recipePeriodResetsToday = true;
        } else {
          daysRemaining = RECIPE_GENERATION_PERIOD_DAYS - diffInDays;
        }
      } catch (e) {
        recipeGenerationsUsed = 0;
        recipePeriodResetsToday = true;
      }
    } else {
      recipeGenerationsUsed = 0;
      recipePeriodResetsToday = true;
    }
    const recipeStatus = {
      generationsUsedThisPeriod: recipeGenerationsUsed,
      limitReached: !isAdmin && (recipeGenerationsUsed >= RECIPE_GENERATION_LIMIT_PER_PERIOD),
      daysRemainingInPeriod: daysRemaining,
      periodResetsToday: recipePeriodResetsToday,
      isAdmin: isAdmin
    };
    return {
      image: imageStatus,
      recipe: recipeStatus,
      showCaloriesField: userProfile.track_calories || false,
      isLoadingProfile: isLoadingProfile
    };
  }, [userProfile, isLoadingProfile]);

  const handleEditGeneratedMeal = (meal: GeneratedMeal) => {
    const mealFormValues: MealFormValues = {
      name: meal.name || "",
      ingredients: meal.ingredients?.map(ing => ({
        name: ing.name || "",
        quantity: ing.quantity !== undefined && ing.quantity !== null ? String(ing.quantity) : "",
        unit: ing.unit || "",
        description: ing.description || "",
      })) || [{ name: "", quantity: "", unit: "", description: "" }],
      instructions: meal.instructions || "",
      meal_tags: meal.meal_tags || [],
      image_url: meal.image_url || "",
      estimated_calories: meal.estimated_calories || "",
      servings: meal.servings || "",
    };
    setCurrentMealFormData(mealFormValues);
    setActiveTab('add'); 
  };
  
  const handleMealSaveSuccess = (savedMeal: {id: string, name: string}) => {
    // Reset states related to meal generation and form data
    setGeneratedMeal(null);
    setGenerateMealSelections({
      selectedMealType: undefined,
      selectedKinds: [],
      selectedStyles: [],
      ingredientPreferences: '',
      refinementPrompt: '',
    });
    setCurrentMealFormData(null); // Clear the form data

    setNewlySavedMealInfo(savedMeal);
    setShowPostSavePlanner(true);
  };

  const handleClosePostSavePlanner = () => {
    setShowPostSavePlanner(false);
    setNewlySavedMealInfo(null);
    setActiveTab('generate'); 
  };
  
  const handleWeekNavigate = (direction: "prev" | "next") => {
    setPlannerWeekStart(prev => addDays(prev, direction === "next" ? 7 : -7));
  };

  // Callback for MealForm to update currentMealFormData
  // This is a simplified version; react-hook-form's watch or getValues might be more robust
  // For now, let's assume MealForm will manage its own state and only set this on "edit generated"
  // or if we explicitly want to save draft manual entries.
  // For this iteration, currentMealFormData is primarily for passing generated data to MealForm.

  if (showPostSavePlanner && userId) {
    return (
      <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
        <AppHeader />
        <div className="container mx-auto space-y-6">
          <div className="relative p-4 border rounded-lg shadow-lg bg-card">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 left-2 text-muted-foreground hover:text-foreground"
              onClick={handleClosePostSavePlanner}
              aria-label="Close planner"
            >
              <X className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold text-center mb-2">
              "{newlySavedMealInfo?.name}" saved!
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Click a slot below to add it to your plan.
            </p>
            
            <div className="flex justify-between items-center mb-4">
              <Button variant="outline" size="sm" onClick={() => handleWeekNavigate("prev")}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
              <h3 className="text-lg font-semibold text-center text-foreground">{formatDateFns(plannerWeekStart, 'MMM dd')} - {formatDateFns(addDays(plannerWeekStart, 6), 'MMM dd, yyyy')}</h3>
              <Button variant="outline" size="sm" onClick={() => handleWeekNavigate("next")}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
            <WeeklyPlanner 
              userId={userId} 
              currentWeekStart={plannerWeekStart} 
              preSelectedMealId={newlySavedMealInfo?.id || null}
              onMealPreSelectedAndPlanned={handleClosePostSavePlanner}
            />
            <div className="mt-6 text-center">
              <Button onClick={handleClosePostSavePlanner}>Done Planning</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
      <AppHeader />
      <div className={cn("space-y-6", !isMobile && "container mx-auto")}>
        
        <div className="flex justify-between items-center mb-0">
            <h1 className="text-xl sm:text-3xl font-bold flex items-center">
              {activeTab === 'generate' ? <Brain className="mr-2 h-6 w-6" /> : <PlusCircle className="mr-2 h-6 w-6" />}
              {activeTab === 'add' ? 'Add Your Own Meal' : 'Generate Meal with AI'}
            </h1>
        </div>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'generate' | 'add')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate with AI</TabsTrigger>
            <TabsTrigger value="add">Add Manually</TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="mt-4">
            <MealForm 
              key={currentMealFormData ? 'edit-mode' : 'add-mode'} // Force re-render if initialData changes significantly
              generationStatus={combinedGenerationLimits.image} 
              isLoadingProfile={combinedGenerationLimits.isLoadingProfile}
              showCaloriesField={combinedGenerationLimits.showCaloriesField}
              initialData={currentMealFormData} // Pass the form data here
              onInitialDataProcessed={() => {
                // Optional: If you want to clear currentMealFormData after MealForm has processed it
                // This might be useful if you want a "fresh" form next time unless explicitly populated
                // For now, let's keep it, so if user switches tabs and back, data is still there.
              }}
              onSaveSuccess={handleMealSaveSuccess}
            />
          </TabsContent>
          <TabsContent value="generate" className="mt-4">
            <GenerateMealFlow 
              recipeGenerationStatus={combinedGenerationLimits.recipe}
              imageGenerationStatus={combinedGenerationLimits.image}
              isLoadingProfile={combinedGenerationLimits.isLoadingProfile}
              userProfile={userProfile ? { 
                ai_preferences: userProfile.ai_preferences, 
                track_calories: userProfile.track_calories 
              } : null}
              onEditGeneratedMeal={handleEditGeneratedMeal}
              onSaveSuccess={handleMealSaveSuccess}
              // Pass state and setters for GenerateMealFlow's inputs
              selections={generateMealSelections}
              onSelectionsChange={setGenerateMealSelections}
              generatedMealData={generatedMeal}
              onGeneratedMealDataChange={setGeneratedMeal}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ManageMealEntryPage;