"use client";

import React from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';

const ToastProvider: React.FC = () => {
  return (
    <div style={{ position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
      <HotToaster
        position="bottom-center" // This will be relative to the wrapper
        gutter={8}
        toastOptions={{
          duration: 5000,
          style: {
            background: '#363636',
            color: '#fff',
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
    </div>
  );
};

export default ToastProvider;