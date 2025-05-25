import React from 'react';
import { Link } from 'react-router-dom';
import { UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming it will be a button or button-like link

interface UserProfileIconProps {
  userId: string; // Assuming it might need the user ID, though not strictly used in this basic version
}

const UserProfileIcon: React.FC<UserProfileIconProps> = ({ userId }) => {
  // This component could fetch profile data later if needed,
  // but for now, it's just an icon linking to the profile page.
  console.log("UserProfileIcon rendered for user:", userId); // Log for debugging

  return (
    <Button variant="ghost" size="icon" asChild aria-label="View Profile">
      <Link to="/profile">
        <UserCircle className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors" />
      </Link>
    </Button>
  );
};

export default UserProfileIcon;