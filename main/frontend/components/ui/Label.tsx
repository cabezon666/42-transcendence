import React from 'react';
import { cn } from '../utils/cn';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export function Label({ className, children, required, ...props }: LabelProps) {
  return (
    <label className={cn('label text-sm sm:text-base font-medium', className)} {...props}>
      {children}
      {required && (
        <span className="text-error ml-1" aria-label="required">
          *
        </span>
      )}
    </label>
  );
}