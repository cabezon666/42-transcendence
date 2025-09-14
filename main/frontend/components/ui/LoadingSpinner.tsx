import React from 'react';
import { cn } from '../utils/cn';

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ 
  size = 'md', 
  text, 
  className, 
  ...props 
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)} {...props}>
      <div className="text-center">
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-muted border-t-primary mx-auto',
            sizeClasses[size]
          )}
        />
        {text && (
          <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        )}
      </div>
    </div>
  );
}