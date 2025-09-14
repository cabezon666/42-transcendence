import React from 'react';
import { cn } from '../utils/cn';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}

const variantIcons = {
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
};

export function Alert({
  variant = 'info',
  icon,
  title,
  children,
  className,
  ...props
}: AlertProps) {
  const displayIcon = icon || variantIcons[variant];

  return (
    <div
      className={cn(
        'alert flex items-start gap-3 p-3 sm:p-4',
        `alert-${variant}`,
        className
      )}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {displayIcon && (
        <div className="flex-shrink-0 mt-0.5" role="img" aria-hidden="true">
          {displayIcon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-medium mb-1 text-sm sm:text-base">{title}</h4>
        )}
        <div className="text-sm leading-relaxed break-words">{children}</div>
      </div>
    </div>
  );
}