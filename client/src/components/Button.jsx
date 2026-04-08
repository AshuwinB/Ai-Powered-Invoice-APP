import React from 'react';

const Button = ({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = '',
    ...props
}) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50';

    const variantClasses = {
        primary: 'bg-teal-600 text-white border border-teal-600 hover:bg-teal-700 focus-visible:ring-teal-500',
        secondary: 'bg-slate-700 text-white border border-slate-700 hover:bg-slate-800 focus-visible:ring-slate-500',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-teal-700 hover:border-teal-400 focus-visible:ring-teal-500',
        destructive: 'bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
    };

    const sizeClasses = {
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base'
    };

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
            onClick={onClick}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;