import FeedbackForm from '@/components/FeedbackForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggleButton } from "@/components/ThemeToggleButton"; // Import

const FeedbackPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 flex flex-col items-center">
      <header className="w-full max-w-xl mb-6"> {/* Use max-w-xl to align with card */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold text-gray-800 dark:text-gray-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
              BitePath
            </Link>
            <ThemeToggleButton />
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>
      <div className="w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Submit Your Feedback</CardTitle>
            <CardDescription>
              We appreciate you taking the time to help us improve BitePath!
              Please let us know what's on your mind.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FeedbackPage;