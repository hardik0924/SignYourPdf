import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Upload, FileText, Download, Clock, CheckCircle, LogOut, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  status: 'pending' | 'signed';
  created_at: string;
}

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('uploader_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);

    try {
      // Create a user-specific folder path
      const userId = user?.id;
      const fileName = `${userId}/${Date.now()}_${file.name}`;

      // Upload file to Supabase Storage with user-specific path
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Create document record
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_url: fileName,
          uploader_id: userId,
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw dbError;
      }

      toast.success('PDF uploaded successfully!');
      fetchDocuments();

      // Navigate to signing view
      navigate(`/sign/${document.id}`);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload file: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const downloadDocument = async (docToDownload: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(docToDownload.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = docToDownload.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('Document downloaded successfully!');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      // Delete signatures first
      await supabase
        .from('signatures')
        .delete()
        .eq('document_id', documentId);

      // Get document to delete file from storage
      const { data: doc } = await supabase
        .from('documents')
        .select('file_url')
        .eq('id', documentId)
        .single();

      if (doc) {
        await supabase.storage
          .from('documents')
          .remove([doc.file_url]);
      }

      // Delete document record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast.success('Document deleted successfully!');
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  // The resetDocument function has been removed.

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-indigo-500 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">SignBuddy</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.user_metadata?.name || user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="mb-12">
          <div
            className={`upload-area border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive ? 'drag-active' : ''
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              Drag and drop your PDF file here, or click to browse
            </h3>
            <p className="text-gray-600 mb-6 text-lg">
              Upload your PDF document to start signing
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 cursor-pointer transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              {uploading ? 'Uploading...' : 'Select PDF file'}
            </label>
          </div>
        </div>

        {/* Documents List */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">Your Documents</h2>

          {documents.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-500">Upload your first PDF to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center flex-1">
                      <FileText className="h-10 w-10 text-red-500 mr-4 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {doc.file_name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(doc.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        doc.status === 'signed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {doc.status === 'signed' ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Signed
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {doc.status === 'pending' && (
                      <Link
                        to={`/sign/${doc.id}`}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-indigo-600 hover:to-purple-600 transition-colors"
                      >
                        Sign
                      </Link>
                    )}
                    <button
                      onClick={() => downloadDocument(doc)}
                      className="flex items-center px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-indigo-600 hover:to-purple-600 transition-colors"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="flex items-center px-3 py-2 border border-indigo-300 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}