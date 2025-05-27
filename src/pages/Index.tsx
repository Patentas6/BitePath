import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { LayoutDashboard, CalendarDays, BrainCircuit, ShoppingCart, Star } from "lucide-react"; // Added Star for testimonials
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"; // Added Card components

const Index = () => {
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

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
      title: "AI-Powered Meal Generation",
      icon: BrainCircuit,
      description: "Never run out of ideas! Describe what you're in the mood for—type, style, ingredients—and let our AI generate a complete meal concept, including a recipe and a unique image.",
      imageUrl: "/Generate_Meal.png", 
      imageAlt: "BitePath AI Meal Generator Screenshot",
      textOrder: "md:order-1",
      imageOrder: "md:order-2",
    },
    {
      id: "grocery-lists",
      title: "Smart & Flexible Grocery Lists",
      icon: ShoppingCart,
      description: "Forget manual list-making. BitePath automatically compiles your shopping list from your meal plan. View items conveniently grouped by store category or see them meal-by-meal.",
      imageUrl: "/Grocery_List_by_Meal.png", 
      imageAlt: "BitePath Grocery List Screenshot",
      textOrder: "md:order-2",
      imageOrder: "md:order-1",
    },
  ];

  const testimonials = [
    {
      name: "Sarah P.",
      quote: "BitePath has revolutionized my meal planning! The AI suggestions are fantastic and the automated grocery list saves me so much time.",
      stars: 5,
    },
    {
      name: "Mike R.",
      quote: "As someone who hates deciding what to eat, BitePath is a lifesaver. I love the weekly planner and how easy it is to add my own recipes.",
      stars: 5,
    },
    {
      name: "Linda K.",
      quote: "The AI image generation for custom meals is such a fun touch! Makes my recipe book look amazing. Highly recommend!",
      stars: 4,
    },
  ];

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
            <a href="#pricing-plans" className="hover:underline text-sm md:text-base">Plans</a>
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
            Ditch the Dinner Dilemma. Embrace the BitePath.
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
            Plan your week in minutes and get an instant grocery list. Less stress, more delicious meals.
          </p>
          <Button size="lg" asChild>
            <Link to="/auth?mode=signup"><span>Start Planning for Free</span></Link>
          </Button>
        </div>
      </section>

      {/* "Glimpse Inside BitePath" Section */}
      <section id="features-glimpse" className="w-full py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">A Glimpse Inside BitePath</h2>
          
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

      {/* Testimonials Section */}
      <section id="testimonials" className="w-full py-16 bg-muted/40 dark:bg-muted/20 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12">What Our Users Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="text-left">
                <CardHeader>
                  <div className="flex items-center mb-2">
                    {Array.from({ length: testimonial.stars }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    ))}
                    {Array.from({ length: 5 - testimonial.stars }).map((_, i) => (
                      <Star key={`empty-${i}`} className="h-5 w-5 text-yellow-400" />
                    ))}
                  </div>
                  <CardTitle>{testimonial.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">"{testimonial.quote}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section id="pricing-plans" className="w-full py-16 bg-background text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-xl text-muted-foreground mb-12">Start for free, or unlock powerful AI features with Premium.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan Card */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">Free</CardTitle>
                <CardDescription>$0 / month</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                <ul className="list-disc list-inside text-left space-y-2 text-muted-foreground">
                  <li>Plan weekly meals</li>
                  <li>Automated grocery lists</li>
                  <li>Save custom recipes</li>
                  <li>Limited AI meal generations</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" variant="outline">
                  <Link to="/auth?mode=signup">Get Started</Link>
                </Button>
              </CardFooter>
            </Card>
            {/* Premium Plan Card */}
            <Card className="border-primary ring-2 ring-primary flex flex-col shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Premium</CardTitle>
                <CardDescription>$9.99 / month</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                <ul className="list-disc list-inside text-left space-y-2 text-muted-foreground">
                  <li>All Free features, plus:</li>
                  <li>Unlimited AI meal generations</li>
                  <li>AI recipe image generation</li>
                  <li>Advanced AI preferences & refinement</li>
                  <li>Priority support (Coming Soon)</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link to="/auth?mode=signup">Upgrade to Premium</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      <footer className="w-full py-8 bg-gray-800 text-white text-center dark:bg-black">
        <div className="container mx-auto px-4">
          <p>&copy; 2025 BitePath. All rights reserved.</p>
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