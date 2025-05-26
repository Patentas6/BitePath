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
  // For testing, always attempt to run the tour.
  const [runTour, setRunTour] = useState(true); 

  useEffect(() => {
    // This useEffect is mainly for re-triggering if needed,
    // but initial run is set by default state.
    // Forcing it to true again in case something resets it.
    setRunTour(true); 
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Temporarily, we set runTour to false to stop the current instance,
      // but it will restart on next Dashboard load due to initial state.
      setRunTour(false); 
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
        console.warn(`Tour target not found: ${data.step.target}`);
    }
    
    console.log('Joyride callback data:', data);
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={runTour} // Directly using the state
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      debug // Enable debug mode for more console output from Joyride
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