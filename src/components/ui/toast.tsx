import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-auto sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:flex-col md:max-w-[420px]", 
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "flex items-center rounded-md py-2 px-4 text-sm",
  {
    variants: {
      variant: {
        success: "bg-success-100 text-success-600",
        error: "bg-error-100 text-error-600",
        warning: "bg-warning-100 text-warning-600",
        info: "bg-info-100 text-info-600",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & ToastProps
>(({ className, children, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants(), className)}
    {...props}
  >
    {children}
  </ToastPrimitives.Root>
))

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("font-semibold", className)}
    {...props}
  />
))

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm", className)}
    {...props}
  />
))

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> & ToastActionElement
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn("ml-2 rounded-md py-2 px-4 text-sm", className)}
    {...props}
  />
))

const ToastClose = () => (
  <ToastAction asChild>
    <button>
      <X className="h-4 w-4" />
    </button>
  </ToastAction>
)

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
  variant?: VariantProps<typeof toastVariants>["variant"];
};

type ToastActionElement = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}