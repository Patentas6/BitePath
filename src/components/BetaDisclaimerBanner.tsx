import React from 'react';
import { Info } from 'lucide-react'; // Using Info icon

const BetaDisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-teal-50 border-b border-teal-200 p-3 text-center text-sm text-teal-700 w-full">
      <div className="container mx-auto flex items-center justify-center">
        <Info size={16} className="mr-2 flex-shrink-0" />
        <span>BitePath Beta: You’re using an early version. Things may change — we’d love your feedback!</span>
      </div>
    </div>
  );
};

export default BetaDisclaimerBanner;