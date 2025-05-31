"use client";

import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void>;
  currentPrompt: string;
  setCurrentPrompt: (prompt: string) => void;
  defaultPrompt: string;
  isGenerating: boolean;
}

export const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  currentPrompt,
  setCurrentPrompt,
  defaultPrompt,
  isGenerating,
}) => {
  useEffect(() => {
    if (isOpen && !currentPrompt) {
      setCurrentPrompt(defaultPrompt);
    }
  }, [isOpen, currentPrompt, defaultPrompt, setCurrentPrompt]);

  const handleGenerateClick = async () => {
    await onGenerate();
    // onClose(); // Optionally close modal after generation starts, or let MealForm handle it
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Meal Image</DialogTitle>
          <DialogDescription>
            Review or customize the prompt for generating the meal image.
            The default prompt is based on your meal name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 items-center gap-4">
            <Input
              id="prompt"
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              placeholder="Enter a prompt for image generation"
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerateClick} disabled={isGenerating || !currentPrompt.trim()}>
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Generate Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};