import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full p-4 bg-background shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link 
              to="/" 
              className="text-2xl font-bold group"
            >
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            {/* ThemeToggleButton removed from here */}
          </div>
          <nav className="flex items-center space-x-4"> {/* Added flex items-center for vertical alignment */}
            <a href="#features" className="hover:underline">Features</a>
            <a href="#pricing" className="hover:underline">Pricing</a>
            <a href="#testimonials" className="hover:underline">Testimonials</a>
            <Link to="/auth" className="hover:underline">Login</Link>
            <Button 
              size="sm" 
              variant="default"
              asChild
            >
              <Link to="/auth?mode=signup"><span>Sign Up</span></Link>
            </Button>
            <ThemeToggleButton /> {/* ThemeToggleButton added here */}
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

      {/* Features Section Placeholder */}
      <section id="features" className="w-full py-16 bg-background text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Core Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> 
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700 bg-card">
              <h3 className="text-xl font-semibold mb-2">AI-Powered Meal Ideas</h3>
              <p className="text-muted-foreground">Discover new recipes with AI-generated meal suggestions, complete with ingredients, instructions, and even an image.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700 bg-card">
              <h3 className="text-xl font-semibold mb-2">Effortless Weekly Planning</h3>
              <p className="text-muted-foreground">Visually organize your breakfast, lunch, dinner, and snacks by easily assigning meals to your weekly calendar.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700 bg-card">
              <h3 className="text-xl font-semibold mb-2">Automated Grocery Lists</h3>
              <p className="text-muted-foreground">Instantly generate a categorized grocery list from your weekly meal plan, saving you time and effort.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section Placeholder */}
      <section id="testimonials" className="w-full py-16 bg-background text-center"> {/* Reverted section to bg-background */}
        <div className="container mx-auto px-4">
          {/* Added inner div styled as a card */}
          <div className="bg-card p-8 border rounded-lg shadow-sm dark:border-gray-700 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">What Our Users Say</h2>
            <p className="text-muted-foreground">Testimonials coming soon!</p>
            {/* Future testimonial items would go inside this box */}
          </div>
        </div>
      </section>

      {/* Pricing Section Placeholder */}
      <section id="pricing" className="w-full py-16 bg-background text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Simple Pricing</h2>
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto"> 
            <div className="p-6 border rounded-lg shadow-sm flex flex-col dark:border-gray-700 bg-card">
              <h3 className="text-2xl font-bold mb-4">Free</h3>
              <p className="text-muted-foreground mb-4">Limited features to get you started.</p>
              <ul className="text-left text-muted-foreground mb-6 flex-grow">
                <li>✓ Basic planning</li>
                <li>✓ Limited meal library</li>
                <li>✓ Grocery list generation</li>
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/auth?mode=signup"><span>Sign Up for Free</span></Link>
              </Button>
            </div>
            <div className="p-6 border rounded-lg shadow-sm flex flex-col dark:border-gray-700 bg-card">
              <h3 className="text-2xl font-bold mb-4">Premium</h3>
              <p className="text-muted-foreground mb-4">Unlock full potential.</p>
               <ul className="text-left text-muted-foreground mb-6 flex-grow">
                <li>✓ Unlimited planning</li>
                <li>✓ Unlimited meal library</li>
                <li>✓ Advanced grocery list</li>
                <li>✓ Priority support</li>
              </ul>
              <Button className="w-full"><span>Go Premium</span></Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full py-8 bg-gray-800 text-white text-center dark:bg-black">
        <div className="container mx-auto px-4">
          <p>&copy; 2025 BitePath. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;