import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SignatureModalProps {
  onClose: () => void;
  onConfirm: (name: string, font: string) => void;
}

// Only show fonts that are actually available in PDF-lib with accurate preview styles
const AVAILABLE_PDF_FONTS = [
  { 
    name: 'Times Roman (Italic)', 
    className: 'font-serif italic text-2xl', 
    value: 'times-roman-italic',
    description: 'Classic serif italic - elegant for signatures'
  },
  { 
    name: 'Helvetica Bold', 
    className: 'font-sans font-bold text-2xl', 
    value: 'helvetica-bold',
    description: 'Clean bold sans-serif - strong and clear'
  },
  { 
    name: 'Helvetica Oblique', 
    className: 'font-sans italic text-2xl', 
    value: 'helvetica-oblique',
    description: 'Slanted sans-serif - modern and stylish'
  },
  { 
    name: 'Times Roman Bold', 
    className: 'font-serif font-bold text-2xl', 
    value: 'times-roman-bold',
    description: 'Bold serif - traditional and authoritative'
  },
  { 
    name: 'Courier Bold', 
    className: 'font-mono font-bold text-2xl', 
    value: 'courier-bold',
    description: 'Bold monospace - distinctive typewriter style'
  },
  { 
    name: 'Helvetica', 
    className: 'font-sans text-2xl', 
    value: 'helvetica',
    description: 'Standard sans-serif - clean and professional'
  },
];

export default function SignatureModal({ onClose, onConfirm }: SignatureModalProps) {
  const [name, setName] = useState('');
  const [selectedFont, setSelectedFont] = useState(AVAILABLE_PDF_FONTS[0].value);

  const handleConfirm = () => {
    if (!name.trim()) {
      return;
    }
    onConfirm(name, selectedFont);
  };

  const previewText = name || 'Your Name';
  const selectedFontData = AVAILABLE_PDF_FONTS.find(f => f.value === selectedFont);

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Set your signature</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name Input */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-3">
              Full name:
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Your name"
            />
          </div>

          {/* Current Selection Preview */}
          {name && selectedFontData && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Preview (as it will appear in PDF):</div>
              <div className={`${selectedFontData.className} text-center py-2`}>
                {previewText}
              </div>
            </div>
          )}

          {/* Font Selection */}
          <div>
            <div className="flex items-center mb-4">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-sm">✓</span>
              </div>
              <span className="text-sm font-medium text-gray-700">Available PDF Fonts</span>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
              {AVAILABLE_PDF_FONTS.map((font) => (
                <button
                  key={font.value}
                  onClick={() => setSelectedFont(font.value)}
                  className={`w-full text-left p-4 border rounded-lg transition-colors ${
                    selectedFont === font.value
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 ${
                      selectedFont === font.value
                        ? 'border-red-500 bg-red-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedFont === font.value && (
                        <div className="w-full h-full rounded-full bg-red-500"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-1">{font.name}</div>
                      <div className={`${font.className} truncate`}>
                        {previewText}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{font.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info about fonts */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> These are native PDF fonts. Your signature will appear exactly as shown in the preview above.
            </p>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="px-8 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}