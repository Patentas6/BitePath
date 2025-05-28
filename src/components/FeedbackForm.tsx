import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState } from 'react';

const scaleOptions = Array.from({ length: 11 }, (_, i) => i.toString()); // 0-10

const feedbackFormSchema = z.object({
  q_wishlist: z.string().optional(),
  q_do_differently: z.string().optional(),
  q_remove_feature: z.string().optional(),
  s_pain_grocery: z.string().optional(),
  s_pain_planning: z.string().optional(),
  s_app_solves_pain: z.string().optional(),
  q_favorite_feature: z.string().optional(),
  q_confusing_feature: z.string().optional(),
  additional_message: z.string().optional(),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

const FeedbackForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      q_wishlist: '',
      q_do_differently: '',
      q_remove_feature: '',
      s_pain_grocery: undefined,
      s_pain_planning: undefined,
      s_app_solves_pain: undefined,
      q_favorite_feature: '',
      q_confusing_feature: '',
      additional_message: '',
    },
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    setIsSubmitting(true);
    const loadingToastId = showLoading("Submitting feedback...");

    // Filter out empty optional string fields to keep payload clean
    const payload = Object.fromEntries(
      Object.entries(values).filter(([_, v]) => v !== '' && v !== undefined)
    );

    try {
      const { data, error } = await supabase.functions.invoke('send-feedback', {
        body: payload, // Send the cleaned payload
      });

      dismissToast(loadingToastId);

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }
      
      showSuccess('Feedback submitted successfully! Thank you.');
      form.reset();
    } catch (error: any) {
      dismissToast(loadingToastId);
      console.error('Error submitting feedback:', error);
      showError(`Failed to submit feedback: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="q_wishlist"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What features or capabilities do you wish BitePath had that it currently doesn't?</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., nutritional information, recipe import from URL..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="q_do_differently"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is there anything about how BitePath currently works that you think should be done differently?</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., the way grocery lists are organized, how meals are added..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="q_remove_feature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Are there any features or aspects of BitePath that you think are unnecessary or should be removed?</FormLabel>
              <FormControl>
                <Textarea placeholder="Your thoughts on simplifying the app..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 p-4 border rounded-md">
          <h3 className="text-md font-semibold mb-3">Pain Points & Solutions (0 = Not at all, 10 = Extremely)</h3>
          <FormField
            control={form.control}
            name="s_pain_grocery"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How much of a pain do you typically find grocery listing?</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a score 0-10" /></SelectTrigger></FormControl>
                  <SelectContent>{scaleOptions.map(opt => <SelectItem key={`pg-${opt}`} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="s_pain_planning"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How much of a pain do you typically find weekly meal planning?</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a score 0-10" /></SelectTrigger></FormControl>
                  <SelectContent>{scaleOptions.map(opt => <SelectItem key={`pp-${opt}`} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="s_app_solves_pain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How well does BitePath currently help solve these pains for you?</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a score 0-10" /></SelectTrigger></FormControl>
                  <SelectContent>{scaleOptions.map(opt => <SelectItem key={`sp-${opt}`} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="q_favorite_feature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your favorite feature or aspect of BitePath so far?</FormLabel>
              <FormControl>
                <Textarea placeholder="What do you love?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="q_confusing_feature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Was there anything you found confusing or difficult to use while using BitePath?</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., a particular button, a step in a process..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="additional_message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Do you have any other comments, ideas, or feedback you'd like to share?</FormLabel>
              <FormControl>
                <Textarea placeholder="Anything else on your mind..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </form>
    </Form>
  );
};

export default FeedbackForm;