import React from 'react';

const Card = ({ children, className = '', ...props }) => {
    return (
        <div
            className={`border-b border-slate-200 bg-transparent shadow-none transition-colors duration-200 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

const CardHeader = ({ children, className = '', ...props }) => {
    return (
        <div className={`flex flex-col space-y-1.5 pb-4 ${className}`} {...props}>
            {children}
        </div>
    );
};

const CardTitle = ({ children, className = '', ...props }) => {
    return (
        <h3 className={`text-xl font-semibold leading-tight tracking-tight text-slate-900 ${className}`} {...props}>
            {children}
        </h3>
    );
};

const CardContent = ({ children, className = '', ...props }) => {
    return (
        <div className={`pb-6 ${className}`} {...props}>
            {children}
        </div>
    );
};

export { Card, CardHeader, CardTitle, CardContent };