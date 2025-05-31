import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase';
import { GeneratedMealData, GenerateMealParams } from '@/types/meal';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useAtom } from 'jotai';
import { 
  generatedMealAtom, 
  isGeneratingRecipeAtom, 
  generationProgressAtom, 
  generationStatusMessageAtom,
  refinementPromptAtom
} from '@/store/mealGenerationStore';

export const useGenerateMeal = () => {
  const queryClient = useQueryClient();
  const [, setGeneratedMeal] = useAtom(generatedMealAtom);
  const [, setIsGeneratingRecipe] = useAtom(isGeneratingRecipeAtom);
  const [, setGenerationProgress] = useAtom(generationProgressAtom);
  const [, setGenerationStatusMessage] = useAtom(generationStatusMessageAtom);
  const [, setRefinementPrompt] = useAtom(refinementPromptAtom);
  // Access generatedMeal for refinement context if needed, but be careful with stale closures
  const [currentGeneratedMeal] = useAtom(generatedMealAtom);


  const { mutate: generateRecipe, isLoading } = useMutation<
    GeneratedMealData | null,
    Error,
    GenerateMealParams,
    unknown
  >(async (params: GenerateMealParams) => {
    setIsGeneratingRecipe(true);
    setGenerationProgress(10);
    setGenerationStatusMessage(params.isRefinement ? "Refining recipe..." : "Preparing to generate recipe...");
    const loadingToastId = showLoading(params.isRefinement ? "Refining your recipe..." : "Generating your recipe...");

    const bodyPayload = {
      prompt: params.prompt,
      preferences: params.preferences,
      isRefinement: params.isRefinement,
      // If refining, and we have a current meal, we could pass its existing details
      // For example, to keep the image or other non-refined parts.
      // However, the current edge function 'generate-meal' only expects prompt and preferences.
      // If refinement needs more context, the edge function and this payload need to be updated.
      // mealToRefine: params.isRefinement && currentGeneratedMeal ? currentGeneratedMeal : undefined,
    };

    console.log("Client (useGenerateMeal): Sending to 'generate-meal' function, bodyPayload:", JSON.stringify(bodyPayload));

    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-meal', { body: bodyPayload });
      dismissToast(loadingToastId);
      setGenerationProgress(100);

      if (functionError) {
        console.error("Function invocation error in useGenerateMeal:", functionError);
        if (functionError.message.includes("Functions_Relay_Error") || functionError.message.includes("429")) {
          showError(`You've reached your recipe generation limit for the current period. Please try again later.`);
        } else {
          showError(`Recipe generation failed: ${functionError.message}`);
        }
        queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', params.userId] });
        setGenerationStatusMessage("Recipe generation failed.");
        setGenerationProgress(0);
        return null;
      }

      if (data?.error) {
        console.error("Data error from function in useGenerateMeal:", data.error);
        showError(data.error.message || data.error);
        queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', params.userId] });
        setGenerationStatusMessage("Recipe generation encountered an issue.");
        setGenerationProgress(0);
        return null;
      }
      
      // Ensure data is in the expected GeneratedMealData format
      const newMealData = data as GeneratedMealData;

      setGeneratedMeal({ 
        ...newMealData, 
        // Preserve existing image if refining and new data doesn't include one
        image_url: params.isRefinement ? (newMealData.image_url || currentGeneratedMeal?.image_url) : newMealData.image_url,
      });
      setRefinementPrompt('');
      showSuccess(params.isRefinement ? "Recipe refined!" : "Recipe generated!");
      queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', params.userId] });
      setGenerationStatusMessage(params.isRefinement ? "Recipe refined successfully!" : "Recipe generated successfully!");
      setTimeout(() => { setGenerationStatusMessage(null); setGenerationProgress(0); }, 5000);
      return newMealData;
    } catch (error: any) {
      console.error("Catch block error in useGenerateMeal:", error);
      dismissToast(loadingToastId);
      showError(`Failed to ${params.isRefinement ? 'refine' : 'generate'} recipe: ${error.message || 'Please try again.'}`);
      setGenerationStatusMessage("An error occurred during recipe generation.");
      setGenerationProgress(0);
      setTimeout(() => setGenerationStatusMessage(null), 5000);
      throw error;
    } finally {
      setIsGeneratingRecipe(false);
    }
  });

  return { generateRecipe, isLoading };
};