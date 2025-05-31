import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase';
import { GeneratedMealData } from '@/types/meal'; // Assuming GeneratedMealData includes image_url
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useAtom } from 'jotai';
import { 
  generatedMealAtom, 
  isGeneratingImageAtom,
  generationProgressAtom,
  generationStatusMessageAtom 
} from '@/store/mealGenerationStore';

interface GenerateImageParams {
  mealToGetImageFor: GeneratedMealData;
  userId: string;
}

// This hook currently calls the 'generate-meal' edge function.
// If 'generate-meal' is *only* for text recipe generation,
// then this hook should call a *different* edge function specifically for image generation,
// or 'generate-meal' needs to be updated to handle both types of requests.
export const useGenerateImageForMeal = () => {
  const queryClient = useQueryClient();
  const [generatedMeal, setGeneratedMeal] = useAtom(generatedMealAtom);
  const [, setIsGeneratingImage] = useAtom(isGeneratingImageAtom);
  const [, setGenerationProgress] = useAtom(generationProgressAtom);
  const [, setGenerationStatusMessage] = useAtom(generationStatusMessageAtom);

  const { mutate: generateImage, isLoading } = useMutation<
    Partial<GeneratedMealData> | null, // Expecting image_url and potentially updated calories/servings
    Error,
    GenerateImageParams, // mealData and userId
    unknown
  >(async ({ mealToGetImageFor, userId }: GenerateImageParams) => {
    if (!mealToGetImageFor || !mealToGetImageFor.name) {
      showError("Cannot generate image: Meal data is incomplete.");
      return null;
    }

    setIsGeneratingImage(true);
    setGenerationProgress(10);
    setGenerationStatusMessage(`Generating image for ${mealToGetImageFor.name}...`);
    const loadingToastId = showLoading(`Generating image for ${mealToGetImageFor.name}...`);

    // IMPORTANT: This body structure is different from what 'generate-meal'
    // expects if it's looking for a 'prompt'.
    // If 'generate-meal' is called with this, req.json().prompt will be undefined.
    const bodyForFunction = {
      mealData: mealToGetImageFor, // Sending the whole meal object
      // Consider if the edge function needs a specific prompt for image generation
      // e.g., prompt: `A delicious looking ${mealToGetImageFor.name}`
      // Or if it can infer from mealData.
    };

    console.log("Client (useGenerateImageForMeal): Sending to 'generate-meal' function, body:", JSON.stringify(bodyForFunction));

    try {
      // Calling 'generate-meal' for image generation.
      // This needs to be handled correctly by the 'generate-meal' edge function
      // OR this should call a different edge function like 'generate-image'.
      const { data, error: functionError } = await supabase.functions.invoke('generate-meal', {
        body: bodyForFunction,
      });
      dismissToast(loadingToastId);
      setGenerationProgress(100);

      if (functionError) {
        console.error("Function invocation error in useGenerateImageForMeal:", functionError);
        if (functionError.message.includes("Functions_Relay_Error") || functionError.message.includes("429")) {
          showError(`Image generation limit reached. Please try again later.`);
        } else {
          showError(`Image generation failed: ${functionError.message}`);
        }
        queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
        setGenerationStatusMessage(`Image generation failed.`);
        setGenerationProgress(0);
        return null;
      }

      if (data?.error) {
        console.error("Data error from function in useGenerateImageForMeal:", data.error);
        showError(data.error.message || data.error);
        queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
        setGenerationStatusMessage(`Image generation error.`);
        setGenerationProgress(0);
        return null;
      }
      
      const resultData = data as Partial<GeneratedMealData>; // Expecting at least image_url

      if (resultData?.image_url !== undefined) {
        setGeneratedMeal(prev => prev ? {
          ...prev,
          image_url: resultData.image_url,
          // Update other fields if the function returns them
          estimated_calories: resultData.estimated_calories !== undefined ? resultData.estimated_calories : prev.estimated_calories,
          servings: resultData.servings !== undefined ? resultData.servings : prev.servings,
        } : null);
        showSuccess("Image generated!");
        setGenerationStatusMessage("Image generated successfully!");
        setTimeout(() => {
          setGenerationStatusMessage(null);
          setGenerationProgress(0);
        }, 5000);
      } else {
        showError("Image generation did not return an image URL.");
        setGenerationStatusMessage("No image URL returned from function.");
        setGenerationProgress(0);
        setTimeout(() => { setGenerationStatusMessage(null); }, 5000);
      }
      queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
      return resultData;
    } catch (error: any) {
      console.error("Catch block error in useGenerateImageForMeal:", error);
      dismissToast(loadingToastId);
      showError(`Failed to generate image: ${error.message || 'Please try again.'}`);
      setGenerationStatusMessage("Image generation failed due to an unexpected error.");
      setGenerationProgress(0);
      setTimeout(() => { setGenerationStatusMessage(null); }, 5000);
      throw error;
    } finally {
      setIsGeneratingImage(false);
    }
  });

  return { generateImage, isLoading };
};