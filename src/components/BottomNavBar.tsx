import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpenText, CalendarDays, ListChecks, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { name: 'Home', path: '/dashboard', icon: Home },
  { name: 'Meals', path: '/meals', icon: BookOpenText },
  { name: 'Planner', path: '/planner', icon: CalendarDays },
  { name: 'Grocery List', path: '/grocery-list', icon: ListChecks },
];

const BottomNavBar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50"> {/* Removed md:hidden */}
      <div className="container mx-auto h-14 flex items-center justify-around">
        {navLinks.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.name}
              to={link.path}
              className={cn(
                "flex flex-col items-center justify-center text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <link.icon className={cn("h-5 w-5 mb-1", isActive ? "text-primary" : "text-muted-foreground")} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;