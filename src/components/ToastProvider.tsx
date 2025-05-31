"use client";

import React from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';

const ToastProvider: React.FC = () => {
  return (
    <HotToaster
      position="bottom-center" // Keeps it centered at the bottom
      gutter={8} // Default spacing, can adjust if needed
      containerStyle={{
        bottom: '70px', // Positions the container 70px from the bottom
        left: '50%', // Necessary for centering when using fixed/absolute positioning
        transform: 'translateX(-50%)', // Center the container
      }}
      toastOptions={{
        // Default options for all toasts
        duration: 5000,
        style: {
          background: '#363636', // Example: dark background
          color: '#fff',        // Example: light text
          minWidth: '250px',
        },
        success: {
          duration: 3000,
          theme: {
            primary: 'green',
            secondary: 'black',
          },
          iconTheme: {
            primary: 'green',
            secondary: 'white',
          }
        },
        error: {
          duration: 4000,
          theme: {
            primary: 'red',
            secondary: 'black',
          },
          iconTheme: {
            primary: 'red',
            secondary: 'white',
          }
        },
      }}
    />
  );
};

export default ToastProvider;