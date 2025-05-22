import { Button } from "@/components/ui/button"; // Assuming shadcn Button is available

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Navigation Bar Placeholder */}
      <header className="w-full p-4 bg-white shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-lg font-bold">BitePath</div>
          <nav className="space-x-4">
            <a href="#features" className="hover:underline">Features</a>
            <a href="#pricing" className="hover:underline">Pricing</a>
            <a href="#testimonials" className="hover:underline">Testimonials</a>
            <a href="/auth" className="hover:underline">Login</a>
            <Button variant="default" size="sm">Sign Up</Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-20 text-center bg-gradient-to-r from-green-50 to-blue-50">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
            Simplify Your Meals, Simplify Your Life.
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8">
            Plan your week in minutes and get an instant grocery list. Less stress, more delicious meals.
          </p>
          <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white">
            Start Planning for Free
          </Button>
        </div>
      </section>

      {/* Features Section Placeholder */}
      <section id="features" className="w-full py-16 bg-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Core Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Minimalist Planning</h3>
              <p className="text-gray-600">Easily drag and drop meals onto your weekly calendar.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Automated Grocery Lists</h3>
              <p className="text-gray-600">Get a simple, consolidated list generated instantly from your plan.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Saves Time & Reduces Stress</h3>
              <p className="text-gray-600">Spend less time deciding what to eat and what to buy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section Placeholder */}
      <section id="testimonials" className="w-full py-16 bg-gray-50 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">What Our Users Say</h2>
          <p className="text-gray-600">Testimonials coming soon!</p>
          {/* Add testimonial cards here later */}
        </div>
      </section>

      {/* Pricing Section Placeholder */}
      <section id="pricing" className="w-full py-16 bg-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Simple Pricing</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-lg mx-auto">
             {/* Free Tier Card */}
            <div className="p-6 border rounded-lg shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold mb-4">Free</h3>
              <p className="text-gray-600 mb-4">Limited features to get you started.</p>
              <ul className="text-left text-gray-700 mb-6 flex-grow">
                <li>✓ Basic planning</li>
                <li>✓ Limited meal library</li>
                <li>✓ Grocery list generation</li>
              </ul>
              <Button variant="outline" className="w-full">Sign Up for Free</Button>
            </div>
            {/* Premium Tier Card */}
            <div className="p-6 border rounded-lg shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold mb-4">Premium</h3>
              <p className="text-gray-600 mb-4">Unlock full potential.</p>
               <ul className="text-left text-gray-700 mb-6 flex-grow">
                <li>✓ Unlimited planning</li>
                <li>✓ Unlimited meal library</li>
                <li>✓ Advanced grocery list</li>
                <li>✓ Priority support</li>
              </ul>
              <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">Go Premium</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Placeholder */}
      <footer className="w-full py-8 bg-gray-800 text-white text-center">
        <div className="container mx-auto px-4">
          <p>&copy; 2024 Minimalist Meal Planner. All rights reserved.</p>
          {/* Add privacy policy, terms links here later */}
        </div>
      </footer>
    </div>
  );
};

export default Index;