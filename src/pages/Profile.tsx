import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const ProfilePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Profile Page (Simplified)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">This is a temporary placeholder for the Profile Page.</p>
          <p className="mb-4">If you can see this, the main app structure is working, and the issue was within the previous Profile Page code.</p>
          <Button asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;