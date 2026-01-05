import React from 'react';
import { Keyboard, X } from 'lucide-react';

export default function ShortcutsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const shortcuts = [
        { key: "S", action: "Select Mode" },
        { key: "P", action: "Pan Mode" },
        { key: "M", action: "Measure Mode" },
        { key: "D", action: "Delete Mode" },
        { key: "R", action: "Draw Rectangle (Structure)" },
        { key: "L", action: "Draw DC Wire" },
        { key: "Esc", action: "Cancel / Deselect" },
        { key: "Del / Backspace", action: "Delete Selected" },
        { key: "Ctrl + Z", action: "Undo" },
        { key: "Ctrl + Y", action: "Redo" },
        { key: "Ctrl + C", action: "Copy" },
        { key: "Ctrl + V", action: "Paste" },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-96 max-w-full overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Keyboard className="w-5 h-5" /> Keyboard Shortcuts
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 gap-2">
                        {shortcuts.map((shortcut, index) => (
                            <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-0">
                                <span className="text-sm text-gray-600">{shortcut.action}</span>
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono font-bold text-gray-700 shadow-sm min-w-[30px] text-center">
                                    {shortcut.key}
                                </kbd>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500">
                        Press <kbd className="font-bold">?</kbd> to toggle this menu
                    </p>
                </div>
            </div>
        </div>
    );
}
