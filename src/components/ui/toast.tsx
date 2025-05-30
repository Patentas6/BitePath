import * as React from 'react';
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toastVariants = cva(
  'flex items-center justify-between gap-2 px-4 py-2 rounded-md',
  {
    variants: {
      variant: {
        success: 'bg-success-100 text-success-600',
        error: 'bg-error-100 text-error-600',
      },
    },
    defaultVariants: {
      variant: 'success',
    },
  }
);

const ToastProvider = ToastPrimitives.Provider;
const ToastViewport = ToastPrimitives.Viewport;

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ children, ...props }, ref) => (
    <ToastPrimitives.Root
      {...props}
      ref={ref}
      className={cn(toastVariants(), 'shadow-md')}
    >
      {children}
    </ToastPrimitives.Root>
  )
);

const ToastActionElement = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>((props, ref) => (
  <div
    {...props}
    ref={ref}
    className={cn('flex items-center justify-center')}
  />
));

type ToastProps = ToastPrimitives.ToastProps & VariantProps<typeof toastVariants>;

type ToastAction = React.ComponentPropsWithoutRef<'div'> & {
  asChild?: boolean;
};

const ToastClose = React.forwardRef<HTMLButtonElement, ToastAction>(
  ({ asChild, ...props }, ref) => {
    const Component = asChild ? ToastActionElement : 'button';

    return (
      <ToastPrimitives.Close as={Component} ref={ref} {...props} />
    );
  }
);

const ToastTitle = ({ children, ...props }: React.ComponentProps<'div'>) => (
  <div
    {...props}
    className={cn('text-sm font-semibold', props.className)}
  >
    {children}
  </div>
);

const ToastDescription = ({ children, ...props }: React.ComponentProps<'div'>) => (
  <div
    {...props}
    className={cn('text-sm', props.className)}
  >
    {children}
  </div>
);

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};