import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { LayoutDashboard, CalendarDays, BrainCircuit, ShoppingCart, ImagePlus, Info, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/lib/supabase";

const Index = () => {
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile(); // Can be undefined initially

  useEffect(() => {
    // Wait for isMobile to be determined
    if (isMobile === undefined) {
      return; 
    }

    if (isMobile) {
      const checkSessionAndRedirect = async () => {
        console.log("[Index.tsx] Mobile detected. Checking session...");
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log("[Index.tsx] Mobile & Session: Redirecting to /dashboard");
          navigate("/dashboard", { replace: true });
        } else {
          console.log("[Index.tsx] Mobile & No Session: Redirecting to /auth");
          navigate("/auth", { replace: true });
        }
      };
      checkSessionAndRedirect();
    } else {
      console.log("[Index.tsx] Desktop detected. Will render landing page.");
    }
  }, [isMobile, navigate]);


  const BitePathStyled = () => (
    <>
      <span className="text-accent dark:text-foreground">Bite</span>
      <span className="text-primary dark:text-primary">Path</span>
    </>
  );

  const imageSections = [
    {
      id: "dashboard",
      title: "Your Daily Dashboard",
      icon: LayoutDashboard,
      description: "Start your day with a clear view. Your dashboard shows all your planned meals for today and the exact ingredients you'll need, making meal prep a breeze.",
      imageUrl: "/Dashboard.png", 
      imageAlt: "BitePath Dashboard Screenshot",
      textOrder: "md:order-1",
      imageOrder: "md:order-2",
    },
    {
      id: "weekly-planning",
      title: "Effortless Weekly Planning",
      icon: CalendarDays,
      description: "Map out your meals for the entire week with our intuitive planner. Assign dishes to breakfast, lunch, dinner, and snacks for each day with ease.",
      imageUrl: "/Weekly_Calendar.png", 
      imageAlt: "BitePath Weekly Planner Screenshot",
      textOrder: "md:order-2",
      imageOrder: "md:order-1",
    },
    {
      id: "ai-generation",
      title: "AI-Powered Meal Ideas",
      icon: BrainCircuit,
      description: "Never run out of ideas! Describe what you're in the mood for—type, style, ingredients—and let our AI generate a complete meal concept, including a recipe and a unique image.",
      imageUrl: "/Generate_Meal.png", 
      imageAlt: "BitePath AI Meal Generator Screenshot",
      textOrder: "md:order-1",
      imageOrder: "md:order-2",
    },
    {
      id: "custom-meal-images",
      title: "Your Recipes, Beautifully Visualized",
      icon: ImagePlus,
      description: <>Bring your family favorites and cherished recipes (like Grandma's secret Apple pie!) to life with <BitePathStyled />'s image generation. After adding them manually, you can generate a unique, appetizing AI image to make your personal cookbook shine.</>,
      imageUrl: "/ADDMEAL.jpeg", 
      imageAlt: "BitePath Add Meal with AI Image Generation Screenshot",
      textOrder: "md:order-2",
      imageOrder: "md:order-1",
    },
    {
      id: "custom-meal-image-example", 
      title: "AI Artwork for Your Recipes",
      icon: Sparkles, 
      description: <>For example, after adding Grandma's apple pie recipe, <BitePathStyled />'s AI can generate a beautiful, unique image like this, ready for your digital cookbook!</>,
      imageUrl: "/ApplePie.png", 
      imageAlt: "AI-generated image of an apple pie",
      textOrder: "md:order-1", 
      imageOrder: "md:order-2",
    },
    {
      id: "grocery-lists",
      title: "Smart & Flexible Grocery Lists",
      icon: ShoppingCart,
      description: <><BitePathStyled /> automatically compiles your shopping list from your meal plan. View items conveniently grouped by store category or see them meal-by-meal.</>,
      imageUrl: "/Grocery_List_by_Meal.png", 
      imageAlt: "BitePath Grocery List Screenshot",
      textOrder: "md:order-2", 
      imageOrder: "md:order-1",
    },
  ];

  // If isMobile is not yet determined, or if it is mobile (and will be redirected), show loading.
  // This prevents rendering the landing page content on mobile.
  if (isMobile === undefined || isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p>Loading...</p>
      </div>
    );
  }

  // Only render landing page content if not mobile (isMobile is false)
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full p-4 bg-background shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link 
              to="/" 
              className="text-2xl font-bold group"
            >
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
          </div>
          <nav className="flex items-center space-x-4">
            <a href="#features-glimpse" className="hover:underline text-sm md:text-base">How It Works</a>
            <a href="#testimonials" className="hover:underline text-sm md:text-base">Testimonials</a>
            <a href="#about-us" className="hover:underline text-sm md:text-base">About Us</a>
            <Link to="/auth" className="hover:underline text-sm md:text-base">Login</Link>
            <Button 
              size="sm" 
              variant="default"
              asChild
              className="text-xs md:text-sm px-2 md:px-3"
            >
              <Link to="/auth?mode=signup"><span>Sign Up</span></Link>
            </Button>
            <ThemeToggleButton />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-20 text-center bg-gradient-to-r from-primary/20 to-accent/20 dark:from-green-900/30 dark:to-blue-900/30">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Meal Planning, Reimagined. This is <span className="whitespace-nowrap">The <BitePathStyled /></span>.
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
            Plan meals in moments, generate custom recipes with AI, visualize them with unique images, and get your shopping list instantly.
          </p>
          <Button size="lg" asChild>
            <Link to="/auth?mode=signup"><span>Start Planning for Free</span></Link>
          </Button>
        </div>
      </section>

      {/* "Glimpse Inside BitePath" Section */}
      <section id="features-glimpse" className="w-full py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">A Glimpse Inside <BitePathStyled /></h2>
          
          {imageSections.map((section, index) => (
            <div key={section.id} className={`flex flex-col md:flex-row items-center gap-8 md:gap-12 ${index < imageSections.length - 1 ? 'mb-16' : ''}`}>
              <div className={`md:w-1/2 ${section.textOrder}`}>
                <div className="flex items-center mb-3">
                  <section.icon className="h-8 w-8 text-primary mr-3" />
                  <h3 className="text-2xl font-semibold">{section.title}</h3>
                </div>
                <p className="text-muted-foreground text-lg">
                  {section.description}
                </p>
              </div>
              <div className={`md:w-1/2 ${section.imageOrder} bg-muted rounded-lg p-6 shadow-lg flex items-center justify-center`}>
                <button 
                  type="button" 
                  onClick={() => setViewingImageUrl(section.imageUrl)}
                  className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg overflow-hidden"
                  aria-label={`View larger image of ${section.imageAlt}`}
                >
                  <img 
                    src={section.imageUrl} 
                    alt={section.imageAlt} 
                    className="rounded-lg shadow-xl max-w-full h-auto cursor-pointer transition-transform hover:scale-105"
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials Section - Modified */}
      <section id="testimonials" className="w-full py-16 bg-muted/40 dark:bg-muted/20 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Testimonials Coming Soon!</h2>
          <p className="text-lg text-muted-foreground">
            We're excited to share what our users think about <BitePathStyled />. Check back later for reviews!
          </p>
        </div>
      </section>

      {/* About Us & Contact Section - Updated */}
      <section id="about-us" className="w-full py-16 bg-background text-center">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex justify-center items-center mb-4">
            <Info className="h-10 w-10 text-primary mr-3" />
            <h2 className="text-3xl font-bold">About Us & Contact</h2>
          </div>
          <p className="text-lg text-muted-foreground mb-6">
            <BitePathStyled /> is dedicated to simplifying your meal planning and grocery shopping experience, 
            giving you more time to enjoy delicious, home-cooked meals.
          </p>
          <p className="text-lg text-muted-foreground">
            For feedback, support, or business inquiries, please contact Nikolas Panagiotou at <a href="mailto:thebitepath@gmail.com" className="text-primary hover:underline">thebitepath@gmail.com</a>.
            We'd love to hear from you!
          </p>
        </div>
      </section>

      <footer className="w-full py-8 bg-gray-800 text-white text-center dark:bg-black">
        <div className="container mx-auto px-4">
          <p>&copy; 2025 <BitePathStyled />. All rights reserved.</p>
        </div>
      </footer>

      {/* Dialog for viewing enlarged image */}
      <Dialog open={!!viewingImageUrl} onOpenChange={(isOpen) => !isOpen && setViewingImageUrl(null)}>
        <DialogContent className="max-w-screen-lg w-[90vw] h-[85vh] p-2 sm:p-4 flex items-center justify-center bg-background">
          {viewingImageUrl && (
            <img
              src={viewingImageUrl}
              alt="Enlarged view"
              className="max-w-full max-h-full object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;