import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

interface UserProfileIconProps { // Renamed interface
  userId: string;
}

const UserProfileIcon: React.FC<UserProfileIconProps> = ({ userId }) => { // Renamed component
  const { data: userProfile, isLoading: isUserProfileLoading } = useQuery<UserProfile | null>({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile for UserProfileIcon:", error); // Updated log
        // Don't throw, just return null to indicate no profile found
        return null;
      }
      return data;
    },
    enabled: !!userId,
  });

  const getInitials = (profile: UserProfile | null) => {
    if (!profile) return null;
    const firstInitial = profile.first_name ? profile.first_name.charAt(0) : '';
    const lastInitial = profile.last_name ? profile.last_name.charAt(0) : '';
    return (firstInitial + lastInitial).toUpperCase();
  };

  const initials = getInitials(userProfile);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full h-9 w-9 md:h-8 md:w-8"
      asChild
      disabled={isUserProfileLoading}
    >
      <Link to="/profile" aria-label="Go to profile">
        {isUserProfileLoading ? (
          <UserCircle className="h-5 w-5 text-muted-foreground" />
        ) : initials ? (
          <span className="text-sm font-medium">{initials}</span>
        ) : (
          <UserCircle className="h-5 w-5 text-muted-foreground" />
        )}
      </Link>
    </Button>
  );
};

export default UserProfileIcon; // Exporting the new name