import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Upload, Shield, Download, Zap, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-red-500 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Sign PDF</h1>
            </div>
            <div className="flex space-x-4">
              <Link
                to="/auth"
                className="text-gray-700 hover:text-red-500 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/auth?mode=signup"
                className="bg-red-500 text-white hover:bg-red-600 px-6 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Sign PDF
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Your tool to eSign documents. Sign a document yourself or send a signature 
            request to others.
          </p>
          
          {/* Upload Section */}
          <div className="max-w-md mx-auto mb-12">
            <Link
              to="/auth?mode=signup"
              className="block w-full bg-red-500 hover:bg-red-600 text-white text-lg font-semibold py-4 px-8 rounded-lg transition-colors mb-4"
            >
              Select PDF file
            </Link>
            <p className="text-gray-500 text-sm">or drop PDF here</p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-20">
            <div className="text-center p-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Upload</h3>
              <p className="text-gray-600">
                Simply drag and drop your PDF files or click to browse and upload.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multiple Signatures</h3>
              <p className="text-gray-600">
                Add multiple signatures with different fonts and styles to your documents.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Legal</h3>
              <p className="text-gray-600">
                Bank-level security with legally binding digital signatures.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">
                Sign documents in seconds, not minutes. No printing or scanning required.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Collaborate</h3>
              <p className="text-gray-600">
                Send signature requests to multiple parties and track progress.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Download</h3>
              <p className="text-gray-600">
                Download your signed documents immediately after completion.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p>&copy; 2024 Sign PDF. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}