import * as React from "react";
import { cn } from "@/lib/utils";

export const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />);
Avatar.displayName = "Avatar";
export const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(({ className, ...props }, ref) => <img ref={ref} className={cn("aspect-square size-full object-cover", className)} {...props} />);
AvatarImage.displayName = "AvatarImage";
export const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("flex size-full items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground", className)} {...props} />);
AvatarFallback.displayName = "AvatarFallback";
