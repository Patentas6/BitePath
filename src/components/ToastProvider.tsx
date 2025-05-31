"use client";

import React from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';

const ToastProvider: React.FC = () => {
  return (
    // This div creates a fixed positioning context for the HotToaster
    <div style={{ 
      position: 'fixed', 
      bottom: '70px', 
      left: '0', // Align to left
      right: '0', // Align to right
      // This effectively makes it full width at the bottom 70px mark,
      // HotToaster's own `position: "bottom-center"` will then center itself within this box.
      zIndex: 9999, // Ensure it's on top
      pointerEvents: 'none' // Allow clicks to pass through the container itself
    }}>
      <HotToaster
        position="bottom-center" 
        gutter={8}
        containerStyle={{ pointerEvents: 'auto' }} // Re-enable pointer events for toasts themselves
        toastOptions={{
          duration: 5000,
          style: {
            background: 'var(--toast-background, #363636)', // Use CSS var or default
            color: 'var(--toast-color, #fff)',             // Use CSS var or default
            minWidth: '250px',
            boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            padding: '12px 18px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e', // green-500
              secondary: '#ffffff',
            },
            style: {
              background: '#166534', // green-800 (darker for contrast)
              color: '#f0fdf4', // green-50
            }
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444', // red-500
              secondary: '#ffffff',
            },
            style: {
              background: '#991b1b', // red-800 (darker for contrast)
              color: '#fef2f2', // red-50
            }
          },
        }}
      />
    </div>
  );
};

export default ToastProvider;