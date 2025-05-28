import React from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';

const BetaDisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-teal-50 border-b border-teal-200 p-3 text-center text-xs sm:text-sm text-teal-700 w-full">
      <div className="container mx-auto flex items-center justify-center">
        <Info size={16} className="mr-2 flex-shrink-0 hidden sm:inline-block" />
        <span className="sm:hidden">
          <Link to="/feedback" className="font-semibold underline hover:text-teal-800">
            Provide Feedback
          </Link>
        </span>
        <span className="hidden sm:inline">
          BitePath Beta: You’re using an early version. Things may change — we’d love your feedback!{' '}
          <Link to="/feedback" className="font-semibold underline hover:text-teal-800">
            Provide Feedback
          </Link>
        </span>
      </div>
    </div>
  );
};

export default BetaDisclaimerBanner;