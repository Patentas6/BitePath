import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import MealTemplateCard, { MealTemplate } from '@/components/MealTemplateCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { showError, showSuccess } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Sparkles, SearchX } from 'lucide-react'; // Added SearchX
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { ThemeToggleButton } from "@/components/ThemeToggleButton"; 

const DiscoverMealsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    };
    fetchUser();
  }, []);

  const { data: mealTemplates, isLoading, error: queryError } = useQuery<MealTemplate[]>({
    queryKey: ['mealTemplates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meal_templates').select('*');
      if (error) throw error; 
      return data || []; 
    },
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery<string[]>({
    queryKey: ['mealTemplateCategories', mealTemplates],
    queryFn: async () => {
      if (!mealTemplates) return [];
      const allCategories = mealTemplates.map(t => t.category).filter(Boolean) as string[];
      return Array.from(new Set(allCategories.flatMap(c => c.split(',').map(s => s.trim())))).sort();
    },
    enabled: !!mealTemplates && mealTemplates.length > 0, 
  });

  const addMealMutation = useMutation({
    mutationFn: async (template: MealTemplate) => {
      if (!userId) throw new Error("User not logged in.");
      const { error } = await supabase.from('meals').insert([{ user_id: userId, name: template.name, ingredients: template.ingredients, instructions: template.instructions, meal_tags: template.meal_tags }]);
      if (error) throw error;
    },
    onSuccess: (data, vars) => { showSuccess(`"${vars.name}" added to your meals!`); queryClient.invalidateQueries({ queryKey: ['meals'] }); },
    onError: (err, vars) => { showError(`Failed to add "${vars.name}": ${(err as Error).message}`); },
  });

  const handleAddToMyMeals = (template: MealTemplate) => addMealMutation.mutate(template);

  const filteredTemplates = mealTemplates?.filter(template => {
    const nameMatch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = selectedCategory === 'all' || (template.category && template.category.toLowerCase().split(',').map(c=>c.trim()).includes(selectedCategory.toLowerCase()));
    return nameMatch && categoryMatch;
  });

  let content;
  if (isLoading) {
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader><Skeleton className="h-40 w-full mb-4" /><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-5/6" /></CardContent>
            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
        ))}
      </div>
    );
  } else if (queryError) {
    content = <p className="text-center text-red-500 dark:text-red-400">Error loading meal templates. Please try again later.</p>;
  } else if (filteredTemplates && filteredTemplates.length > 0) {
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(t => 
          <MealTemplateCard 
            key={t.id} 
            template={t} 
            onAddToMyMeals={handleAddToMyMeals} 
            isAdding={addMealMutation.isPending && addMealMutation.variables?.id === t.id} 
          />
        )}
      </div>
    );
  } else {
    content = (
      <div className="text-center py-10 text-muted-foreground">
        <SearchX className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
        <p className="text-lg font-semibold mb-1">No Templates Found</p>
        <p className="text-sm">
          {mealTemplates && mealTemplates.length > 0 ? "No templates match your current search or category." : "We're still cooking up templates! Check back soon."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold text-gray-800 dark:text-gray-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
              BitePath
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center text-gray-800 dark:text-gray-100">
            <Sparkles className="h-8 w-8 mr-3 text-teal-600 hidden sm:block" />
            <h1 className="text-xl sm:text-3xl font-bold">Discover Meal Templates</h1>
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search meal templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {isLoadingCategories && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                  {categories?.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        {content}

      </div>
    </div>
  );
};

export default DiscoverMealsPage;