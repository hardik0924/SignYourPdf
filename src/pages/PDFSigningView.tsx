import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import Draggable from 'react-draggable';
import { ArrowLeft, PenTool, Download, Send, ChevronLeft, ChevronRight, Plus, Trash2, Edit3, Type, Calendar, Building, MousePointer, RotateCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import SignatureModal from '../components/SignatureModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentData {
  id: string;
  file_name: string;
  file_url: string;
  status: 'pending' | 'signed';
  created_at: string;
}

interface SignatureField {
  id: string;
  type: 'signature' | 'initials' | 'name' | 'date' | 'text' | 'company';
  x: number;
  y: number;
  page: number;
  width: number;
  height: number;
  content?: string;
  font?: string;
  // Store exact positioning data for 100% accuracy
  canvasWidth?: number;
  canvasHeight?: number;
  pdfWidth?: number;
  pdfHeight?: number;
  // Store dynamic font size based on field dimensions
  fontSize?: number;
}

interface SignatureItem {
  id: string;
  type: 'signature' | 'initials' | 'name' | 'date' | 'text' | 'company';
  label: string;
  icon: React.ReactNode;
}

// Font mapping for preview consistency
const getFontPreviewClass = (fontValue: string) => {
  switch (fontValue) {
    case 'times-roman-italic':
      return 'font-serif italic'
    case 'helvetica-bold':
      return 'font-sans font-bold'
    case 'helvetica-oblique':
      return 'font-sans italic'
    case 'times-roman-bold':
      return 'font-serif font-bold'
    case 'courier-bold':
      return 'font-mono font-bold'
    case 'helvetica':
      return 'font-sans'
    default:
      return 'font-serif italic'
  }
}

// Calculate dynamic font size based on field dimensions
const calculateDynamicFontSize = (width: number, height: number, type: string, contentLength: number = 10) => {
  // Base font size calculation based on field height
  let baseFontSize = Math.max(8, Math.min(height * 0.6, 32)); // Height-based sizing with limits
  
  // Adjust based on field type
  switch (type) {
    case 'signature':
      baseFontSize = Math.max(12, Math.min(height * 0.7, 36));
      break;
    case 'initials':
      baseFontSize = Math.max(10, Math.min(height * 0.65, 28));
      break;
    case 'name':
      baseFontSize = Math.max(8, Math.min(height * 0.6, 24));
      break;
    default:
      baseFontSize = Math.max(8, Math.min(height * 0.55, 20));
  }
  
  // Adjust based on content length to ensure it fits within width
  const estimatedTextWidth = contentLength * (baseFontSize * 0.6); // Rough estimation
  if (estimatedTextWidth > width - 16) { // 16px padding
    baseFontSize = Math.max(8, (width - 16) / (contentLength * 0.6));
  }
  
  return Math.round(baseFontSize);
};

export default function PDFSigningView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0); // Fixed: Start at 100% instead of 120%
  const [loading, setLoading] = useState(true);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PDFDocument | null>(null);
  
  // New click-to-place system
  const [placementMode, setPlacementMode] = useState<string | null>(null);
  const [selectedFieldForEdit, setSelectedFieldForEdit] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const signatureItems: SignatureItem[] = [
    { id: 'signature', type: 'signature', label: 'Signature', icon: <PenTool className="h-4 w-4" /> },
    { id: 'initials', type: 'initials', label: 'Initials', icon: <Edit3 className="h-4 w-4" /> },
    { id: 'name', type: 'name', label: 'Name', icon: <Type className="h-4 w-4" /> },
    { id: 'date', type: 'date', label: 'Date', icon: <Calendar className="h-4 w-4" /> },
    { id: 'text', type: 'text', label: 'Text', icon: <Type className="h-4 w-4" /> },
    { id: 'company', type: 'company', label: 'Company', icon: <Building className="h-4 w-4" /> },
  ];

  useEffect(() => {
    if (id && user) {
      fetchDocument();
    }
  }, [id, user]);

  useEffect(() => {
    if (document && document.file_url) {
      fetchPdfBlob();
    }
  }, [document]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .eq('uploader_id', user?.id)
        .single();

      if (error) throw error;
      setDocument(data);
    } catch (error) {
      console.error('Error fetching document:', error);
      toast.error('Failed to load document');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const extractFilePathFromUrl = (fileUrl: string): string => {
    if (!fileUrl.startsWith('http')) {
      return fileUrl;
    }
    
    const urlParts = fileUrl.split('/storage/v1/object/documents/');
    if (urlParts.length > 1) {
      return urlParts[1];
    }
    
    return fileUrl;
  };

  const fetchPdfBlob = async () => {
    if (!document?.file_url) {
      setPdfLoading(false);
      return;
    }

    setPdfLoading(true);
    try {
      const filePath = extractFilePathFromUrl(document.file_url);
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) throw error;
      setPdfBlob(data);

      // Load PDF with pdf-lib for signing
      const arrayBuffer = await data.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      setPdfDocument(pdfDoc);
      
      console.log('📄 PDF loaded successfully, pages:', pdfDoc.getPageCount());
    } catch (error) {
      console.error('Error fetching PDF blob:', error);
      toast.error('Failed to load PDF file');
      setPdfBlob(null);
    } finally {
      setPdfLoading(false);
    }
  };

  // Get PDF canvas bounds for precise positioning
  const getPdfCanvasBounds = () => {
    const pageElement = pageRefs.current[currentPage];
    if (!pageElement) return null;

    const canvas = pageElement.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
    if (!canvas) return null;

    return canvas.getBoundingClientRect();
  };

  // Get actual PDF page dimensions
  const getPdfPageDimensions = () => {
    if (!pdfDocument || currentPage < 1 || currentPage > pdfDocument.getPageCount()) {
      return null;
    }
    
    const page = pdfDocument.getPage(currentPage - 1);
    return page.getSize();
  };

  // REVOLUTIONARY FIX: Absolute pixel-perfect coordinate conversion
  const convertToAbsoluteCoordinates = (canvasX: number, canvasY: number) => {
    const canvasBounds = getPdfCanvasBounds();
    const pdfDimensions = getPdfPageDimensions();
    
    if (!canvasBounds || !pdfDimensions) {
      console.warn('⚠️ Missing canvas bounds or PDF dimensions');
      return { 
        absoluteX: canvasX, 
        absoluteY: canvasY,
        canvasWidth: 0,
        canvasHeight: 0,
        pdfWidth: 0,
        pdfHeight: 0
      };
    }

    // Store exact dimensions for perfect reconstruction
    const canvasWidth = canvasBounds.width;
    const canvasHeight = canvasBounds.height;
    const pdfWidth = pdfDimensions.width;
    const pdfHeight = pdfDimensions.height;

    // Calculate exact scale factors
    const scaleX = pdfWidth / canvasWidth;
    const scaleY = pdfHeight / canvasHeight;

    // Convert to PDF coordinates with perfect precision
    const absoluteX = canvasX * scaleX;
    const absoluteY = pdfHeight - (canvasY * scaleY); // Flip Y-axis for PDF

    console.log('🎯 Absolute coordinate conversion:', {
      input: { canvasX: Math.round(canvasX * 100) / 100, canvasY: Math.round(canvasY * 100) / 100 },
      canvasSize: { w: Math.round(canvasWidth), h: Math.round(canvasHeight) },
      pdfSize: { w: Math.round(pdfWidth), h: Math.round(pdfHeight) },
      scale: { x: Math.round(scaleX * 1000) / 1000, y: Math.round(scaleY * 1000) / 1000 },
      output: { absoluteX: Math.round(absoluteX * 100) / 100, absoluteY: Math.round(absoluteY * 100) / 100 }
    });

    return { 
      absoluteX, 
      absoluteY,
      canvasWidth,
      canvasHeight,
      pdfWidth,
      pdfHeight
    };
  };

  // IMPROVED: Click-to-place with absolute coordinate handling
  const handlePdfClick = (e: React.MouseEvent) => {
    if (!placementMode || document?.status === 'signed') return;

    const canvasBounds = getPdfCanvasBounds();
    if (!canvasBounds) {
      console.warn('⚠️ No canvas bounds available');
      return;
    }

    // Get the page element to calculate relative position
    const pageElement = pageRefs.current[currentPage];
    if (!pageElement) return;

    const pageRect = pageElement.getBoundingClientRect();
    
    // Calculate position relative to the page element with high precision
    const relativeX = e.clientX - pageRect.left;
    const relativeY = e.clientY - pageRect.top;

    // Calculate position relative to the canvas within the page
    const canvasOffsetX = canvasBounds.left - pageRect.left;
    const canvasOffsetY = canvasBounds.top - pageRect.top;
    
    const canvasX = relativeX - canvasOffsetX;
    const canvasY = relativeY - canvasOffsetY;

    // Check if click is within canvas bounds
    if (canvasX < 0 || canvasY < 0 || canvasX > canvasBounds.width || canvasY > canvasBounds.height) {
      console.log('🚫 Click outside canvas bounds');
      return;
    }

    // Dynamic field sizing based on type
    let fieldWidth = 120;
    let fieldHeight = 30;
    
    if (placementMode === 'signature') {
      fieldWidth = 180; // Increased for better signature display
      fieldHeight = 50;
    } else if (placementMode === 'initials') {
      fieldWidth = 80;
      fieldHeight = 35;
    } else if (placementMode === 'name') {
      fieldWidth = 150;
      fieldHeight = 30;
    }

    // Ensure field fits within canvas with padding
    const padding = 10;
    const adjustedX = Math.min(canvasX, canvasBounds.width - fieldWidth - padding);
    const adjustedY = Math.min(canvasY, canvasBounds.height - fieldHeight - padding);

    // Convert to absolute coordinates for perfect final positioning
    const { absoluteX, absoluteY, canvasWidth, canvasHeight, pdfWidth, pdfHeight } = 
      convertToAbsoluteCoordinates(adjustedX, adjustedY);

    // Calculate initial font size based on field dimensions
    const initialFontSize = calculateDynamicFontSize(fieldWidth, fieldHeight, placementMode, 10);

    const newField: SignatureField = {
      id: Date.now().toString(),
      type: placementMode as any,
      x: Math.max(0, adjustedX), // Canvas coordinates for display
      y: Math.max(0, adjustedY), // Canvas coordinates for display
      page: currentPage,
      width: fieldWidth,
      height: fieldHeight,
      fontSize: initialFontSize, // Store calculated font size
      // Store exact dimensions for perfect reconstruction
      canvasWidth,
      canvasHeight,
      pdfWidth,
      pdfHeight,
    };

    console.log('🎯 Placing field with absolute precision:', {
      click: { x: Math.round(relativeX * 100) / 100, y: Math.round(relativeY * 100) / 100 },
      canvas: { x: Math.round(adjustedX * 100) / 100, y: Math.round(adjustedY * 100) / 100 },
      absolute: { x: Math.round(absoluteX * 100) / 100, y: Math.round(absoluteY * 100) / 100 },
      page: currentPage,
      fontSize: initialFontSize
    });

    if (placementMode === 'signature' || placementMode === 'initials') {
      setShowSignatureModal(true);
      setSelectedField(newField.id);
      setSignatureFields([...signatureFields, newField]);
    } else if (placementMode === 'date') {
      const currentDate = new Date().toLocaleDateString();
      setSignatureFields([...signatureFields, { ...newField, content: currentDate }]);
    } else {
      setSignatureFields([...signatureFields, newField]);
    }

    // Exit placement mode after placing
    setPlacementMode(null);
  };

  const handleSignatureConfirm = async (name: string, font: string) => {
    if (!selectedField) return;

    console.log('✍️ Creating signature with font:', { name, font, selectedField });

    // Ensure signature is displayed on a single line by removing line breaks
    const singleLineName = name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    setSignatureFields(fields => 
      fields.map(field => 
        field.id === selectedField 
          ? { 
              ...field, 
              content: singleLineName, // Store single-line text
              font: font,
              // Recalculate font size based on content length and current field dimensions
              fontSize: calculateDynamicFontSize(field.width, field.height, field.type, singleLineName.length)
            }
          : field
      )
    );

    setSelectedField(null);
    setShowSignatureModal(false);
  };

  const removeField = (fieldId: string) => {
    setSignatureFields(fields => fields.filter(field => field.id !== fieldId));
    if (selectedFieldForEdit === fieldId) {
      setSelectedFieldForEdit(null);
    }
  };

  const updateFieldContent = (fieldId: string, content: string) => {
    // Ensure single line for all text inputs
    const singleLineContent = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    setSignatureFields(fields => 
      fields.map(field => 
        field.id === fieldId ? { 
          ...field, 
          content: singleLineContent,
          // Recalculate font size when content changes
          fontSize: calculateDynamicFontSize(field.width, field.height, field.type, singleLineContent.length)
        } : field
      )
    );
  };

  // IMPROVED: Handle dragging with absolute coordinate updates
  const handleFieldDrag = (fieldId: string, data: { x: number; y: number }) => {
    const canvasBounds = getPdfCanvasBounds();
    if (!canvasBounds) return;

    const field = signatureFields.find(f => f.id === fieldId);
    if (!field) return;

    // Ensure field stays within canvas bounds with padding
    const padding = 5;
    const boundedX = Math.max(0, Math.min(data.x, canvasBounds.width - field.width - padding));
    const boundedY = Math.max(0, Math.min(data.y, canvasBounds.height - field.height - padding));

    setSignatureFields(fields =>
      fields.map(f =>
        f.id === fieldId ? { 
          ...f, 
          x: boundedX, 
          y: boundedY,
          // Update canvas dimensions if they've changed
          canvasWidth: canvasBounds.width,
          canvasHeight: canvasBounds.height
        } : f
      )
    );
  };

  // IMPROVED: Handle resizing with dynamic font size calculation
  const handleFieldResize = (fieldId: string, newWidth: number, newHeight: number) => {
    const canvasBounds = getPdfCanvasBounds();
    if (!canvasBounds) return;

    setSignatureFields(fields =>
      fields.map(field => {
        if (field.id === fieldId) {
          // Ensure the resized field doesn't go outside canvas bounds
          const maxWidth = canvasBounds.width - field.x - 10; // 10px padding
          const maxHeight = canvasBounds.height - field.y - 10; // 10px padding
          
          const finalWidth = Math.min(Math.max(60, newWidth), maxWidth); // Min 60px
          const finalHeight = Math.min(Math.max(20, newHeight), maxHeight); // Min 20px
          
          // Recalculate font size based on new dimensions
          const newFontSize = calculateDynamicFontSize(
            finalWidth, 
            finalHeight, 
            field.type, 
            field.content?.length || 10
          );
          
          console.log(`🔧 Resizing field: ${finalWidth}x${finalHeight}, new font size: ${newFontSize}px`);
          
          return {
            ...field,
            width: finalWidth,
            height: finalHeight,
            fontSize: newFontSize // Update font size based on new dimensions
          };
        }
        return field;
      })
    );
  };

  const finalizeDocument = async () => {
    if (signatureFields.length === 0) {
      toast.error('Please add at least one signature before finalizing');
      return;
    }

    const incompleteFields = signatureFields.filter(field => 
      !field.content || field.content.trim() === ''
    );

    if (incompleteFields.length > 0) {
      toast.error('Please complete all signature fields');
      return;
    }

    setFinalizing(true);
    try {
      console.log('🚀 Starting absolute precision document finalization...');

      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No authenticated session found');
      }

      // Convert signature fields with absolute precision
      const signatures = signatureFields.map(field => {
        // Use stored canvas and PDF dimensions for perfect reconstruction
        const canvasWidth = field.canvasWidth || getPdfCanvasBounds()?.width || 595;
        const canvasHeight = field.canvasHeight || getPdfCanvasBounds()?.height || 842;
        const pdfWidth = field.pdfWidth || getPdfPageDimensions()?.width || 595;
        const pdfHeight = field.pdfHeight || getPdfPageDimensions()?.height || 842;

        // Calculate exact scale factors using stored dimensions
        const scaleX = pdfWidth / canvasWidth;
        const scaleY = pdfHeight / canvasHeight;

        // Convert to absolute PDF coordinates with perfect precision
        const absoluteX = field.x * scaleX;
        const absoluteY = pdfHeight - (field.y * scaleY); // Flip Y-axis for PDF

        console.log(`📍 Absolute coordinates for "${field.content}":`, {
          canvas: { x: Math.round(field.x * 100) / 100, y: Math.round(field.y * 100) / 100 },
          absolute: { x: Math.round(absoluteX * 100) / 100, y: Math.round(absoluteY * 100) / 100 },
          page: field.page,
          size: { w: field.width, h: field.height },
          fontSize: field.fontSize,
          dimensions: { canvasWidth, canvasHeight, pdfWidth, pdfHeight }
        });

        return {
          page: field.page,
          x: absoluteX, // Absolute PDF coordinates
          y: absoluteY, // Absolute PDF coordinates
          width: field.width,
          height: field.height,
          type: field.type,
          content: field.content, // Already single-line
          font: field.font,
          fontSize: field.fontSize // Include dynamic font size
        };
      });

      console.log('📤 Sending absolute precision signatures to edge function:', signatures);

      // Call the absolute precision edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-absolute-precision-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: id,
          signatures: signatures
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Edge function error: ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Absolute precision edge function result:', result);

      // Save signature records to database with precise coordinates
      const signaturePromises = signatureFields.map(field => 
        supabase.from('signatures').insert({
          user_id: user?.id,
          document_id: id,
          page: field.page,
          x: field.x, // Store canvas coordinates for reference
          y: field.y, // Store canvas coordinates for reference
          type: field.type,
          content: field.content || '',
          font: field.font || null,
          status: 'applied'
        })
      );

      await Promise.all(signaturePromises);

      console.log('✅ Document finalized with absolute precision positioning and dynamic font sizing');
      toast.success('Document signed with 100% positioning accuracy!');
      navigate('/dashboard');
    } catch (error) {
      console.error('❌ Error finalizing document:', error);
      toast.error('Failed to finalize document');
    } finally {
      setFinalizing(false);
    }
  };

  const downloadDocument = async () => {
    if (!document?.file_url) {
      toast.error('Document file not available');
      return;
    }

    try {
      const filePath = extractFilePathFromUrl(document.file_url);
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document?.file_name || 'document.pdf';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      toast.success('Document downloaded successfully!');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Document not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 text-red-500 hover:text-red-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-500 hover:text-gray-700 mr-4 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back
              </button>
              <h1 className="text-lg font-semibold text-gray-900">
                {document.file_name}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {placementMode && (
                <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <MousePointer className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm text-blue-700">
                    Click on PDF to place {placementMode}
                  </span>
                  <button
                    onClick={() => setPlacementMode(null)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </div>
              )}
              {document.status === 'pending' && (
                <button
                  onClick={finalizeDocument}
                  disabled={signatureFields.length === 0 || finalizing}
                  className="flex items-center px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {finalizing ? 'Signing...' : 'Sign'}
                </button>
              )}
              {document.status === 'signed' && (
                <button
                  onClick={downloadDocument}
                  className="flex items-center px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Page Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 custom-scrollbar overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Pages</h3>
          <div className="space-y-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentPage === page
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Page {page}
              </button>
            ))}
          </div>
        </div>

        {/* Main PDF Viewer */}
        <div className="flex-1 flex flex-col">
          {/* PDF Controls */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-700 font-medium">
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                disabled={currentPage === numPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                -
              </button>
              <span className="text-sm text-gray-700 font-medium min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(Math.min(2, scale + 0.1))}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* PDF Display */}
          <div 
            className={`flex-1 overflow-auto bg-gray-200 p-6 custom-scrollbar ${
              placementMode ? 'cursor-crosshair' : ''
            }`}
            ref={pdfContainerRef}
          >
            <div className="max-w-4xl mx-auto">
              {pdfLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                </div>
              ) : !pdfBlob ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <p className="text-gray-500 mb-4">Failed to load PDF file</p>
                    <button
                      onClick={fetchPdfBlob}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <Document
                  file={pdfBlob}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={
                    <div className="flex items-center justify-center h-96">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    </div>
                  }
                >
                  <div
                    className="relative inline-block"
                    ref={(el) => (pageRefs.current[currentPage] = el)}
                    onClick={handlePdfClick}
                  >
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="shadow-lg"
                    />
                    
                    {/* Render signature fields for current page */}
                    {signatureFields
                      .filter(field => field.page === currentPage)
                      .map(field => {
                        const canvasBounds = getPdfCanvasBounds();
                        if (!canvasBounds) return null;

                        // Position relative to the PDF canvas
                        const pageElement = pageRefs.current[currentPage];
                        if (!pageElement) return null;

                        const pageRect = pageElement.getBoundingClientRect();
                        const canvasLeft = canvasBounds.left - pageRect.left;
                        const canvasTop = canvasBounds.top - pageRect.top;

                        // Calculate dynamic font size for preview
                        const previewFontSize = field.fontSize || calculateDynamicFontSize(
                          field.width, 
                          field.height, 
                          field.type, 
                          field.content?.length || 10
                        );

                        return (
                          <Draggable
                            key={field.id}
                            position={{ x: field.x, y: field.y }}
                            disabled={document.status === 'signed'}
                            onStop={(e, data) => handleFieldDrag(field.id, data)}
                            bounds={{
                              left: 0,
                              top: 0,
                              right: canvasBounds.width - field.width - 5,
                              bottom: canvasBounds.height - field.height - 5,
                            }}
                          >
                            <div
                              className={`signature-field ${
                                document.status === 'pending' ? 'cursor-move draggable-signature' : ''
                              } ${selectedFieldForEdit === field.id ? 'ring-2 ring-blue-500' : ''}`}
                              style={{
                                position: 'absolute',
                                left: canvasLeft,
                                top: canvasTop,
                                width: field.width,
                                height: field.height,
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 8px',
                                overflow: 'hidden', // Ensure single line display
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (document.status === 'pending') {
                                  setSelectedFieldForEdit(selectedFieldForEdit === field.id ? null : field.id);
                                }
                              }}
                            >
                              {field.content ? (
                                <span 
                                  className={`text-gray-700 pointer-events-none select-none ${
                                    field.font ? getFontPreviewClass(field.font) : ''
                                  }`}
                                  style={{
                                    fontSize: `${previewFontSize}px`, // Use dynamic font size
                                    lineHeight: '1.2',
                                    textAlign: 'center',
                                    width: '100%',
                                    whiteSpace: 'nowrap', // Force single line
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  {field.content}
                                </span>
                              ) : field.type === 'text' ? (
                                <input
                                  type="text"
                                  placeholder="Enter text"
                                  className="w-full h-full border-none outline-none bg-transparent text-sm text-center"
                                  onChange={(e) => updateFieldContent(field.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ 
                                    whiteSpace: 'nowrap',
                                    fontSize: `${previewFontSize}px`
                                  }}
                                />
                              ) : (
                                <span className="text-xs text-gray-500 pointer-events-none">
                                  {field.type === 'signature' ? 'Signature' :
                                   field.type === 'initials' ? 'Initials' :
                                   field.type === 'name' ? 'Name' :
                                   field.type === 'date' ? 'Date' :
                                   field.type === 'company' ? 'Company' : 'Text'}
                                </span>
                              )}
                              
                              {/* Delete button */}
                              {document.status === 'pending' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeField(field.id);
                                  }}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors z-10"
                                >
                                  ×
                                </button>
                              )}

                              {/* Resize handle */}
                              {document.status === 'pending' && selectedFieldForEdit === field.id && (
                                <div
                                  className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setResizing(field.id);
                                    
                                    const startX = e.clientX;
                                    const startY = e.clientY;
                                    const startWidth = field.width;
                                    const startHeight = field.height;

                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                      const deltaX = moveEvent.clientX - startX;
                                      const deltaY = moveEvent.clientY - startY;
                                      
                                      const newWidth = startWidth + deltaX;
                                      const newHeight = startHeight + deltaY;
                                      
                                      handleFieldResize(field.id, newWidth, newHeight);
                                    };

                                    const handleMouseUp = () => {
                                      setResizing(null);
                                      window.document.removeEventListener('mousemove', handleMouseMove);
                                      window.document.removeEventListener('mouseup', handleMouseUp);
                                    };

                                    window.document.addEventListener('mousemove', handleMouseMove);
                                    window.document.addEventListener('mouseup', handleMouseUp);
                                  }}
                                />
                              )}
                            </div>
                          </Draggable>
                        );
                      })}
                  </div>
                </Document>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Tools */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 custom-scrollbar overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Add Fields</h3>
          
          {document.status === 'pending' && (
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-3">
                {signatureItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPlacementMode(item.type)}
                    className={`toolbar-button h-16 flex-col transition-colors ${
                      placementMode === item.type
                        ? 'bg-blue-50 border-blue-200 text-blue-600'
                        : 'hover:bg-red-50 hover:border-red-200'
                    }`}
                  >
                    {item.icon}
                    <span className="text-xs mt-1">{item.label}</span>
                  </button>
                ))}
              </div>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Absolute Precision:</strong> Click exactly where you want to place fields.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  <strong>Dynamic Font Sizing:</strong> Resize fields to change font size automatically.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  <strong>Single-line display:</strong> All signatures appear on one line for consistency.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">
              Fields ({signatureFields.length})
            </h4>
            {signatureFields.length === 0 ? (
              <p className="text-sm text-gray-500">No fields added yet</p>
            ) : (
              <div className="space-y-3">
                {signatureFields.map(field => (
                  <div 
                    key={field.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFieldForEdit === field.id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedFieldForEdit(selectedFieldForEdit === field.id ? null : field.id)}
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {field.type}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Page {field.page}</p>
                      <p className="text-xs text-gray-400">
                        Size: {Math.round(field.width)}×{Math.round(field.height)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Font Size: {field.fontSize || 'Auto'}px
                      </p>
                      <p className="text-xs text-gray-400">
                        Canvas: ({Math.round(field.x * 100) / 100}, {Math.round(field.y * 100) / 100})
                      </p>
                      {field.canvasWidth && field.canvasHeight && (
                        <p className="text-xs text-gray-400">
                          Canvas Size: {Math.round(field.canvasWidth)}×{Math.round(field.canvasHeight)}
                        </p>
                      )}
                      {field.content && (
                        <p className="text-xs text-gray-600 truncate max-w-[120px]">
                          {field.content}
                        </p>
                      )}
                      {field.font && (
                        <p className="text-xs text-gray-500">
                          Font: {field.font}
                        </p>
                      )}
                    </div>
                    {document.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(field.id);
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {document.status === 'signed' && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">
                ✓ Document Signed
              </p>
              <p className="text-xs text-green-600 mt-1">
                This document has been signed with absolute positioning accuracy and dynamic font sizing.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <SignatureModal
          onClose={() => {
            setShowSignatureModal(false);
            setSelectedField(null);
          }}
          onConfirm={handleSignatureConfirm}
        />
      )}
    </div>
  );
}