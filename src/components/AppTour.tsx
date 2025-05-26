import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { supabase } from '@/lib/supabase'; // Import Supabase client
import { useQueryClient } from '@tanstack/react-query';

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
    target: '[data-tourid="tour-generate-meal-button"]',
    content: 'Feeling adventurous? Let our AI generate a new meal idea for you! An image will be generated as well.',
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-add-meal-button"]',
    content: 'Got a recipe in mind? Add it manually here. An image for your custom meal can be generated too!',
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
  onTourEnd?: () => void; // Optional callback if Dashboard needs to know
}

const AppTour: React.FC<AppTourProps> = ({ startTour, userId, onTourEnd }) => {
  const [run, setRun] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Delay slightly to ensure DOM elements are ready
    const timer = setTimeout(() => {
      setRun(startTour);
    }, 500); // Increased delay slightly
    return () => clearTimeout(timer);
  }, [startTour]);

  const markTourAsCompleted = async () => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ has_completed_tour: true })
        .eq('id', userId);
      if (error) {
        console.error("Error updating tour status:", error);
      } else {
        console.log("Tour status updated for user:", userId);
        // Invalidate profile query if Dashboard relies on it, though Dashboard makes its own decision to start
        queryClient.invalidateQueries({ queryKey: ['userProfileForDashboardTour', userId] });
      }
    } catch (e) {
      console.error("Exception updating tour status:", e);
    }
    if (onTourEnd) onTourEnd();
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || action === 'close') {
      setRun(false);
      markTourAsCompleted();
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
        console.warn(`Tour target not found: ${data.step.target}`);
    } else if (type === EVENTS.TOUR_END && (action === 'reset' || action === 'stop')) {
        // This case might also indicate tour was closed or programmatically stopped
        setRun(false);
        markTourAsCompleted();
    }
    
    // console.log('Joyride callback data:', data); // Keep for debugging if needed
  };

  if (!userId) return null; // Don't render if no userId

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      // debug // Keep for debugging if needed
      styles={{
        options: {
          zIndex: 10000, 
          primaryColor: 'hsl(var(--primary))', 
          textColor: 'hsl(var(--foreground))',
          arrowColor: 'hsl(var(--background))',
          backgroundColor: 'hsl(var(--background))',
        },
        tooltip: {
          borderRadius: 'var(--radius)',
        },
        buttonNext: {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
        },
        buttonBack: {
            color: 'hsl(var(--primary))',
        },
        buttonSkip: {
            color: 'hsl(var(--muted-foreground))',
        }
      }}
    />
  );
};

export default AppTour;