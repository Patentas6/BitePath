import MealList from "@/components/MealList";
import AppHeader from "@/components/AppHeader"; 
import { useIsMobile } from "@/hooks/use-mobile"; // Import useIsMobile
import { cn } from "@/lib/utils"; // Import cn

const MealsPage = () => {
  const isMobile = useIsMobile(); // Initialize useIsMobile

  return (
    <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
      <AppHeader /> 
      <div className={cn("space-y-6", !isMobile && "container mx-auto")}>
        {/* Desktop header is now handled by the single AppHeader above */}
        
        {/* Title - hidden on mobile */}
        <div className={cn("flex justify-center items-center mb-0", isMobile && "hidden")}>
            <h1 className="text-xl sm:text-3xl font-bold">My Meals</h1>
        </div>
        <div className="space-y-6">
          <MealList />
        </div>
      </div>
    </div>
  );
};

export default MealsPage;