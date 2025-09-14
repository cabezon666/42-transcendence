import React from 'react';
import { cn } from '../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, helperText, ...props }, ref) => {
    // Generate unique IDs for accessibility
    const inputId = props.id || `input-${React.useId()}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="space-y-1">
        <input
          {...props}
          id={inputId}
          className={cn(
            'input min-h-[44px] text-base sm:text-sm', // Ensure minimum touch target size and prevent zoom on iOS
            error && 'border-error focus-visible:ring-error',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={cn(
            errorId,
            helperId
          ).trim() || undefined}
          ref={ref}
        />
        {error && (
          <p 
            id={errorId}
            className="text-sm text-error"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p 
            id={helperId}
            className="text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';