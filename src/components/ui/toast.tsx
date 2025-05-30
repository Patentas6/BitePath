import * as React from 'react';
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn-util';

const toastVariants = cva(
  'flex items-center shadow-md rounded-md py-2 pl-4 pr-8',
  {
    variants: {
      variant: {
        success: 'bg-success-100 text-success-800',
        error: 'bg-error-100 text-error-800',
        warning: 'bg-warning-100 text-warning-800',
        info: 'bg-info-100 text-info-800',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 left-1/2 z-[100] flex max-h-screen w-full -translate-x-1/2 flex-col-reverse p-4 sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

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
));

interface ToastActionElement {
  action: React.ReactNode;
}

interface ToastProps {
  variant?: VariantProps<typeof toastVariants>['variant'];
}

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> & ToastActionElement
>(({ className, action, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn('ml-2', className)}
    {...props}
  >
    {action}
  </ToastPrimitives.Action>
));

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn('absolute right-2 top-2', className)}
    {...props}
  />
));

const ToastTitle = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('font-bold', className)}
    {...props}
  />
));

const ToastDescription = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm', className)}
    {...props}
  />
));

export { ToastProvider, ToastViewport, Toast, ToastAction, ToastClose, ToastTitle, ToastDescription };