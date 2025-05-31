"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button"; // For SignInButton styling if needed

export default function AddMealPage() {
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 style={{ color: 'green', fontSize: '28px', border: '3px solid green', padding: '15px', margin: '15px 0', textAlign: 'center' }}>
        TESTING ADD-MEAL/PAGE.TSX (V3)
      </h1>

      <SignedIn>
        <h2 style={{ color: 'darkblue', backgroundColor: 'lightblue', padding: '10px', marginTop: '20px' }}>
          User is SIGNED IN. Add Meal Form should appear below if re-added.
        </h2>
        <Link href="/my-meals" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-4 mt-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to My Meals (if signed in)
        </Link>
        {/* AddMealForm would go here once this page rendering is confirmed */}
        {/* <AddMealForm /> */}
      </SignedIn>

      <SignedOut>
        <div style={{ border: '2px solid orange', padding: '20px', textAlign: 'center', marginTop: '20px' }}>
          <h2 style={{ color: 'orange' }}>User is SIGNED OUT.</h2>
          <p>You need to sign in to add a meal.</p>
          <div style={{ marginTop: '15px' }}>
            <SignInButton mode="modal">
              <Button variant="default">Sign In</Button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <p>Current Auth Status (Clerk UserButton):</p>
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}