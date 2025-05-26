import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS, ACTIONS } from 'react-joyride';

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tourid="tour-logo"]',
    content: 'Welcome to BitePath! This is your main dashboard area.',
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-my-meals-button"]',
    content: 'Manage your custom meals here. Add new ones or edit existing recipes.',
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-generate-meal-button"]',
    content: 'Feeling adventurous? Let our AI generate a new meal idea for you!',
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-add-meal-button"]',
    content: 'Got a recipe in mind? Add it manually using this button.',
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-planning-button"]',
    content: 'Plan your weekly meals and generate grocery lists in the "Plan & Shop" section.',
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-profile-button"]',
    content: 'Update your profile information and AI preferences here.',
    placement: 'bottom',
  },
];

const AppTour: React.FC = () => {
  const [runTour, setRunTour] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Ensure component is mounted before trying to access localStorage
    const tourCompleted = localStorage.getItem('bitepathTourCompleted');
    if (!tourCompleted) {
      setRunTour(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      localStorage.setItem('bitepathTourCompleted', 'true');
      setRunTour(false);
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
        console.warn(`Tour target not found: ${data.step.target}`);
        // Optionally, you could advance the tour or stop it
        // For now, we'll let Joyride handle it (it usually skips the step or stops)
    }
    
    console.log('Joyride callback data:', data);
  };

  if (!isMounted) {
    return null; // Don't render Joyride until localStorage can be safely accessed
  }

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={runTour}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      styles={{
        options: {
          zIndex: 10000, // Ensure it's above other elements
          primaryColor: 'hsl(var(--primary))', // Use your app's primary color
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