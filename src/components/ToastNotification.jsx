import React, { useEffect } from 'react';
import { useSolarStore } from '../stores/solarStore';

export default function ToastNotification() {
    const toast = useSolarStore((state) => state.toast);
    const hideToast = useSolarStore((state) => state.hideToast);

    useEffect(() => {
        if (toast.visible) {
            const timer = setTimeout(() => {
                hideToast();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast.visible, hideToast]);

    if (!toast.visible) return null;

    const bgColors = {
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        success: 'bg-green-500',
        info: 'bg-blue-500'
    };

    const icons = {
        error: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        success: 'fa-circle-check',
        info: 'fa-circle-info'
    };

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
            <div className={`${bgColors[toast.type] || bgColors.info} text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 min-w-[300px] justify-center`}>
                <i className={`fas ${icons[toast.type] || icons.info}`}></i>
                <span className="font-medium text-sm">{toast.message}</span>
                <button onClick={hideToast} className="ml-2 opacity-80 hover:opacity-100">
                    <i className="fas fa-times"></i>
                </button>
            </div>
        </div>
    );
}
