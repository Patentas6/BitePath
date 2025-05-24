import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full p-4 bg-card shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link 
              to="/" 
              className="text-2xl font-bold group"
            >
              <span className="text-accent transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <nav className="space-x-4">
            <a href="#features" className="hover:underline">Features</a>
            <a href="#pricing" className="hover:underline">Pricing</a>
            <a href="#testimonials" className="hover:underline">Testimonials</a>
            <Link to="/auth" className="hover:underline">Login</Link>
            <Button variant="default" size="sm" asChild>
              <Link to="/auth?mode=signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-20 text-center bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Simplify Your Meals, Simplify Your Life.
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
            Plan your week in minutes and get an instant grocery list. Less stress, more delicious meals.
          </p>
          <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white" asChild>
            <Link to="/auth?mode=signup">Start Planning for Free</Link>
          </Button>
        </div>
      </section>

      {/* Features Section Placeholder */}
      <section id="features" className="w-full py-16 bg-card text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Core Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700">
              <h3 className="text-xl font-semibold mb-2">Minimalist Planning</h3>
              <p className="text-muted-foreground">Easily place meals onto your weekly calendar.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700">
              <h3 className="text-xl font-semibold mb-2">Automated Grocery Lists</h3>
              <p className="text-muted-foreground">Get a simple, consolidated list generated instantly from your plan.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700">
              <h3 className="text-xl font-semibold mb-2">Saves Time & Reduces Stress</h3>
              <p className="text-muted-foreground">Spend less time deciding what to eat and what to buy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section Placeholder */}
      <section id="testimonials" className="w-full py-16 bg-background text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">What Our Users Say</h2>
          <p className="text-muted-foreground">Testimonials coming soon!</p>
        </div>
      </section>

      {/* Pricing Section Placeholder */}
      <section id="pricing" className="w-full py-16 bg-card text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Simple Pricing</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-lg mx-auto">
            <div className="p-6 border rounded-lg shadow-sm flex flex-col dark:border-gray-700">
              <h3 className="text-2xl font-bold mb-4">Free</h3>
              <p className="text-muted-foreground mb-4">Limited features to get you started.</p>
              <ul className="text-left text-muted-foreground mb-6 flex-grow">
                <li>✓ Basic planning</li>
                <li>✓ Limited meal library</li>
                <li>✓ Grocery list generation</li>
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/auth?mode=signup">Sign Up for Free</Link>
              </Button>
            </div>
            <div className="p-6 border rounded-lg shadow-sm flex flex-col dark:border-gray-700">
              <h3 className="text-2xl font-bold mb-4">Premium</h3>
              <p className="text-muted-foreground mb-4">Unlock full potential.</p>
               <ul className="text-left text-muted-foreground mb-6 flex-grow">
                <li>✓ Unlimited planning</li>
                <li>✓ Unlimited meal library</li>
                <li>✓ Advanced grocery list</li>
                <li>✓ Priority support</li>
              </ul>
              <Button className="w-full">Go Premium</Button>
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