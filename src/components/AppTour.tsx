import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS, TooltipRenderProps } from 'react-joyride';
import { supabase } from '@/lib/supabase'; 
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tourid="tour-logo"]',
    content: 'Welcome to BitePath, your smart meal planning assistant!',
    placement: 'bottom',
    disableBeacon: true, 
  },
  {
    target: '[data-tourid="tour-home-button"]',
    content: "This is your main home area. Here you'll find today's planned meals and your grocery list for the day.",
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tourid="tour-my-meals-button"]',
    content: 'Manage your meals here. All your saved meals will be available, where you can edit or delete them.',
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-new-meal-button"]',
    content: "Click 'New Meal' to access options for both adding a recipe manually or using our AI to generate a new meal idea. You'll find these choices on the next page!",
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-planning-button"]',
    content: "Plan your weekly meals and generate grocery lists in the 'Plan & Shop' section.",
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-profile-button"]',
    content: 'Update your profile information, including AI preferences, here.',
    placement: 'bottom',
  },
];

interface AppTourProps {
  startTour: boolean;
  userId: string | null;
  onTourEnd?: () => void; 
}

const AppTour: React.FC<AppTourProps> = ({ startTour, userId, onTourEnd }) => {
  const [run, setRun] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setRun(startTour);
      if (startTour) {
        setDontShowAgain(false); 
      }
    }, 500); 
    return () => clearTimeout(timer);
  }, [startTour]);

  const persistTourCompletionPreference = async () => {
    if (!userId) return;

    if (dontShowAgain) { 
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ has_completed_tour: true })
          .eq('id', userId);
        if (error) {
          console.error("Error updating tour status to true:", error);
        } else {
          console.log("Tour status updated to true (user selected 'Don't show again').");
          queryClient.invalidateQueries({ queryKey: ['userProfileForDashboardTour', userId] });
        }
      } catch (e) {
        console.error("Exception updating tour status to true:", e);
      }
    } else {
      console.log("Tour ended, 'Don't show again' was not selected. Profile 'has_completed_tour' not updated by tour end.");
      queryClient.invalidateQueries({ queryKey: ['userProfileForDashboardTour', userId] });
    }
    if (onTourEnd) onTourEnd();
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || action === 'close') {
      setRun(false);
      persistTourCompletionPreference();
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
        console.warn(`Tour target not found: ${data.step.target}`);
    } else if (type === EVENTS.TOUR_END && (action === 'reset' || action === 'stop')) {
        setRun(false);
        persistTourCompletionPreference();
    }
  };

  const CustomTooltipComponent = ({
    continuous,
    index,
    step,
    isLastStep,
    size,
    backProps,
    primaryProps,
    skipProps,
    tooltipProps,
  }: TooltipRenderProps) => (
    <div {...tooltipProps} className="bg-background p-4 rounded-lg shadow-xl w-72 text-foreground border border-border">
      {step.title && <h4 className="text-lg font-semibold mb-2 text-primary">{step.title}</h4>}
      <div className="text-sm mb-4">{step.content}</div>
      
      <div className="flex items-center mb-3">
        <Checkbox
          id={`joyride-dont-show-again-${index}`}
          checked={dontShowAgain}
          onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
          className="mr-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <Label htmlFor={`joyride-dont-show-again-${index}`} className="text-xs cursor-pointer">
          Don't show this again
        </Label>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-muted-foreground">
          Step {index + 1} of {size}
        </span>
        <div className="flex items-center space-x-2">
          {index > 0 && <Button {...backProps} variant="outline" size="sm">Back</Button>}
          {/* Ensure Skip button is always rendered if skipProps exist */}
          {skipProps && <Button {...skipProps} variant="ghost" size="sm">Skip Tour</Button>}
          {/* Next/Finish button logic */}
          {continuous && !isLastStep && <Button {...primaryProps} size="sm">Next</Button>}
          {continuous && isLastStep && <Button {...primaryProps} size="sm">Finish</Button>}
        </div>
      </div>
    </div>
  );

  if (!userId) return null; 

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      callback={handleJoyrideCallback}
      continuous
      showProgress={false} 
      showSkipButton={true} // This prop enables skipProps to be passed to tooltipComponent
      tooltipComponent={CustomTooltipComponent}
      styles={{
        options: {
          zIndex: 10000,
        },
      }}
    />
  );
};

export default AppTour;