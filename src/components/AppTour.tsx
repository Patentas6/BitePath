import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS, ACTIONS } from 'react-joyride';

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
    disableBeacon: true, // Also disable beacon for this important first functional step
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
    content: "Plan your weekly meals and generate grocery lists in the 'Plan & Shop' section.", // Please provide new text if desired
    placement: 'bottom',
  },
  {
    target: '[data-tourid="tour-profile-button"]',
    content: 'Update your profile information, including AI preferences, here.', // Please provide new text if desired
    placement: 'bottom',
  },
];

const AppTour: React.FC = () => {
  const [runTour, setRunTour] = useState(false); 

  useEffect(() => {
    const timer = setTimeout(() => {
      setRunTour(true); 
    }, 100); 

    return () => clearTimeout(timer); 
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTour(false); 
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
        console.warn(`Tour target not found: ${data.step.target}`);
    }
    
    console.log('Joyride callback data:', data);
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={runTour} 
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      debug 
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