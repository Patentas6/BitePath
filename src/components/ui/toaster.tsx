"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import React from "react"

type SonnerProps = React.ComponentProps<typeof Sonner>;
// Ensure our ToasterProps can receive all Sonner props, including offset and style
interface ToasterProps extends SonnerProps {}

const Toaster = ({ offset, style: incomingStyle, position = "bottom-center", ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  const dynamicContainerStyle: React.CSSProperties = {};

  // Determine the effective position to correctly apply the offset
  const effectivePosition = props.position || position; // Use position from props if provided, else default

  if (effectivePosition.includes('bottom')) {
    if (typeof offset === 'number') {
      dynamicContainerStyle.bottom = `${offset}px`;
    } else if (typeof offset === 'string') {
      // If offset is already a string like "240px", use it directly
      dynamicContainerStyle.bottom = offset;
    }
  } else if (effectivePosition.includes('top')) {
    // Similar logic if we were using top positioning
    if (typeof offset === 'number') {
      dynamicContainerStyle.top = `${offset}px`;
    } else if (typeof offset === 'string') {
      dynamicContainerStyle.top = offset;
    }
  }
  // Add other position handling (left, right) if needed, though Sonner's offset usually handles X-axis for corners.

  return (
    <Sonner
      theme={theme as SonnerProps["theme"]}
      className="toaster group" // This className could have conflicting global styles
      position={effectivePosition} // Pass the determined position
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props} // Spread other props passed to our Toaster component
      offset={offset} // Still pass Sonner's own offset prop, it might do more than just set 'bottom'
      style={{ ...incomingStyle, ...dynamicContainerStyle }} // Merge incoming styles with our dynamic style
                                                            // Our dynamic style for 'bottom' will take precedence if keys match
    />
  )
}

export { Toaster }