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
import { ArrowLeft, Search, Sparkles } from 'lucide-react';

const DiscoverMealsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUserId();
  }, []);

  const { data: mealTemplates, isLoading, error } = useQuery<MealTemplate[]>({
    queryKey: ['mealTemplates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_templates')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery<string[]>({
    queryKey: ['mealTemplateCategories'],
    queryFn: async () => {
      if (!mealTemplates) return [];
      const allCategories = mealTemplates
        .map(template => template.category)
        .filter(Boolean) as string[];
      
      const uniqueCategories = Array.from(new Set(
        allCategories.flatMap(cat => cat.split(',').map(c => c.trim()))
      )).sort();
      return uniqueCategories;
    },
    enabled: !!mealTemplates,
  });

  const addMealMutation = useMutation({
    mutationFn: async (template: MealTemplate) => {
      if (!userId) {
        showError("You must be logged in to add meals.");
        throw new Error("User not logged in.");
      }
      const { error } = await supabase.from('meals').insert([
        {
          user_id: userId,
          name: template.name,
          ingredients: template.ingredients,
          instructions: template.instructions,
          // We don't copy category or image_url to personal meals by default
        },
      ]);
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      showSuccess(`"${variables.name}" added to your meals!`);
      queryClient.invalidateQueries({ queryKey: ['meals'] }); // Invalidate user's personal meals list
    },
    onError: (error, variables) => {
      showError(`Failed to add "${variables.name}": ${error.message}`);
    },
  });

  const handleAddToMyMeals = (template: MealTemplate) => {
    addMealMutation.mutate(template);
  };

  const filteredTemplates = mealTemplates?.filter(template => {
    const nameMatch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = selectedCategory === 'all' || 
                          (template.category && template.category.toLowerCase().split(',').map(c=>c.trim()).includes(selectedCategory.toLowerCase()));
    return nameMatch && categoryMatch;
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center">
            <Sparkles className="h-8 w-8 mr-3 text-teal-600" />
            <h1 className="text-3xl font-bold">Discover Meal Templates</h1>
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-white rounded-lg shadow">
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

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="flex flex-col">
                <CardHeader><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                <CardContent className="flex-grow"><Skeleton className="h-20 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
              </Card>
            ))}
          </div>
        )}

        {error && <p className="text-red-500">Error loading meal templates: {error.message}</p>}

        {!isLoading && !error && filteredTemplates && filteredTemplates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <MealTemplateCard 
                key={template.id} 
                template={template} 
                onAddToMyMeals={handleAddToMyMeals}
                isAdding={addMealMutation.isPending && addMealMutation.variables?.id === template.id}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && (!filteredTemplates || filteredTemplates.length === 0) && (
          <div className="text-center py-10">
            <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Meal Templates Found</h3>
            <p className="text-gray-500">
              {mealTemplates && mealTemplates.length > 0 ? "No templates match your current filters." : "It looks like there are no meal templates available at the moment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverMealsPage;