import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format as formatDateFns, startOfWeek, addDays, parseISO } from "date-fns";
import { IMAGE_GENERATION_LIMIT_PER_MONTH, RECIPE_GENERATION_LIMIT_PER_PERIOD, RECIPE_GENERATION_PERIOD_DAYS, PLANNING_MEAL_TYPES, PlanningMealType } from '@/lib/constants';
import { useIsMobile } from "@/hooks/use-mobile"; 
import { cn } from "@/lib/utils";

import AppHeader from "@/components/AppHeader";
import MealForm, { GenerationStatusInfo as MealFormGenerationStatus, MealFormValues } from "@/components/MealForm";
import GenerateMealFlow, { GeneratedMeal } from "@/components/GenerateMealFlow"; 
import WeeklyPlanner from "@/components/WeeklyPlanner"; 
import AddMealToPlanDialog from "@/components/AddMealToPlanDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; 
import { Button } from '@/components/ui/button'; 
import { PlusCircle, Brain, X, ChevronLeft, ChevronRight } from 'lucide-react'; 

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

interface NewlySavedMealInfo {
  id: string;
  name: string;
  servings: string | null | undefined;
}

interface AddToPlanDialogState {
  open: boolean;
  planDate: Date | null;
  initialMealType?: PlanningMealType | string | null;
  preSelectedMealId?: string;
  preSelectedMealName?: string;
  originalMealServings?: string | null;
}

const ManageMealEntryPage = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'add'>('generate');
  const [mealDataForManualForm, setMealDataForManualForm] = useState<GeneratedMeal | null>(null);
  const isMobile = useIsMobile();
  
  const [showPostSavePlanner, setShowPostSavePlanner] = useState(false);
  const [newlySavedMealInfo, setNewlySavedMealInfo] = useState<NewlySavedMealInfo | null>(null);
  const [plannerWeekStart, setPlannerWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const [addToPlanDialogState, setAddToPlanDialogState] = useState<AddToPlanDialogState>({
    open: false,
    planDate: null,
  });

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
    setMealDataForManualForm(meal);
    setActiveTab('add'); 
  };

  const mealFormInitialData = useMemo((): MealFormValues | null => {
    if (!mealDataForManualForm) return null;
    
    const ingredientsForForm = (mealDataForManualForm.ingredients || []).map(ing => ({
      name: ing.name || "",
      quantity: ing.quantity !== undefined && ing.quantity !== null ? String(ing.quantity) : "",
      unit: ing.unit || "",
      description: ing.description || "",
    }));

    return {
      name: mealDataForManualForm.name || "",
      ingredients: ingredientsForForm, 
      instructions: mealDataForManualForm.instructions || "",
      meal_tags: mealDataForManualForm.meal_tags || [],
      image_url: mealDataForManualForm.image_url || "",
      estimated_calories: mealDataForManualForm.estimated_calories || "",
      servings: mealDataForManualForm.servings || "",
    };
  }, [mealDataForManualForm]);

  const handleMealFormInitialDataProcessed = () => {
    // Callback for MealForm after it processes initialData
  };
  
  const handleMealSaveSuccess = (savedMeal: {id: string, name: string, servings?: string | null | undefined}) => {
    setMealDataForManualForm(null); 
    setNewlySavedMealInfo({
      id: savedMeal.id,
      name: savedMeal.name,
      servings: savedMeal.servings || "Not specified", // Ensure it's a string
    });
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

  const handleOpenServingsDialogForNewMeal = (
    planDate: Date, 
    mealType: PlanningMealType, 
    mealId: string, 
    mealName: string, 
    originalServings: string | null | undefined
  ) => {
    setAddToPlanDialogState({
      open: true,
      planDate,
      initialMealType: mealType,
      preSelectedMealId: mealId,
      preSelectedMealName: mealName,
      originalMealServings: originalServings,
    });
  };

  if (showPostSavePlanner && userId && newlySavedMealInfo) {
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
              "{newlySavedMealInfo.name}" saved!
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Click a slot below to add it to your plan and set servings.
            </p>
            
            <div className="flex justify-between items-center mb-4">
              <Button variant="outline" size="sm" onClick={() => handleWeekNavigate("prev")}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
              <h3 className="text-lg font-semibold text-center text-foreground">{formatDateFns(plannerWeekStart, 'MMM dd')} - {formatDateFns(addDays(plannerWeekStart, 6), 'MMM dd, yyyy')}</h3>
              <Button variant="outline" size="sm" onClick={() => handleWeekNavigate("next")}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
            <WeeklyPlanner 
              userId={userId} 
              currentWeekStart={plannerWeekStart} 
              preSelectedMealId={newlySavedMealInfo.id}
              preSelectedMealName={newlySavedMealInfo.name}
              preSelectedMealOriginalServings={newlySavedMealInfo.servings}
              onPreselectedMealSlotClick={handleOpenServingsDialogForNewMeal}
              // onMealPreSelectedAndPlanned prop is now handled by AddMealToPlanDialog's onSaveSuccessCallback
            />
            <div className="mt-6 text-center">
              <Button onClick={handleClosePostSavePlanner}>Done Planning For Now</Button>
            </div>
          </div>
        </div>
        {addToPlanDialogState.open && userId && (
          <AddMealToPlanDialog
            open={addToPlanDialogState.open}
            onOpenChange={(open) => setAddToPlanDialogState(prev => ({ ...prev, open }))}
            planDate={addToPlanDialogState.planDate}
            userId={userId}
            initialMealType={addToPlanDialogState.initialMealType}
            preSelectedMealId={addToPlanDialogState.preSelectedMealId}
            preSelectedMealName={addToPlanDialogState.preSelectedMealName}
            originalMealServings={addToPlanDialogState.originalMealServings}
            onSaveSuccessCallback={handleClosePostSavePlanner} // This will close the post-save planner view
          />
        )}
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
              key={mealDataForManualForm ? 'edit-mode' : 'add-mode'} 
              generationStatus={combinedGenerationLimits.image} 
              isLoadingProfile={combinedGenerationLimits.isLoadingProfile}
              showCaloriesField={combinedGenerationLimits.showCaloriesField}
              initialData={mealFormInitialData}
              onInitialDataProcessed={handleMealFormInitialDataProcessed}
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
            />
          </TabsContent>
        </Tabs>
      </div>
      {/* Render AddMealToPlanDialog for general use if needed, though current flow focuses on post-save */}
      {/* This instance is primarily for the post-save flow */}
      {addToPlanDialogState.open && userId && !showPostSavePlanner && (
          <AddMealToPlanDialog
            open={addToPlanDialogState.open}
            onOpenChange={(open) => setAddToPlanDialogState(prev => ({ ...prev, open }))}
            planDate={addToPlanDialogState.planDate}
            userId={userId}
            initialMealType={addToPlanDialogState.initialMealType}
            preSelectedMealId={addToPlanDialogState.preSelectedMealId}
            preSelectedMealName={addToPlanDialogState.preSelectedMealName}
            originalMealServings={addToPlanDialogState.originalMealServings}
            // No onSaveSuccessCallback here if it's not the post-save flow, or a different one.
          />
        )}
    </div>
  );
};

export default ManageMealEntryPage;