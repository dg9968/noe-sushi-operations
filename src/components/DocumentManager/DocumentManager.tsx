import React, { useState, useEffect } from 'react';
import { Document } from '../../types';
import './DocumentManager.css';

const DocumentManager: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);

  useEffect(() => {
    const savedDocs = localStorage.getItem('noe-sushi-documents');
    if (savedDocs) {
      setDocuments(JSON.parse(savedDocs));
    }
  }, []);

  const saveDocuments = (docs: Document[]) => {
    localStorage.setItem('noe-sushi-documents', JSON.stringify(docs));
    setDocuments(docs);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);
    const newDocuments: Document[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newDoc: Document = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: 'other',
          fileData: e.target?.result as string, // Base64 encoded data
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          uploadDate: new Date(),
          lastModified: new Date(),
        };

        // For text files, also store readable content
        if (file.type.startsWith('text/') || file.type === 'application/json') {
          const textReader = new FileReader();
          textReader.onload = (textEvent) => {
            newDoc.content = textEvent.target?.result as string;
            newDocuments.push(newDoc);

            if (newDocuments.length === files.length) {
              saveDocuments([...documents, ...newDocuments]);
              setIsUploading(false);
            }
          };
          textReader.readAsText(file);
        } else {
          newDocuments.push(newDoc);

          if (newDocuments.length === files.length) {
            saveDocuments([...documents, ...newDocuments]);
            setIsUploading(false);
          }
        }
      };
      reader.readAsDataURL(file); // Read as base64
    });
  };

  const deleteDocument = (id: string) => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      const updatedDocs = documents.filter(doc => doc.id !== id);
      saveDocuments(updatedDocs);
    }
  };

  const viewDocument = (doc: Document) => {
    setViewingDocument(doc);
  };

  const downloadDocument = (doc: Document) => {
    let blob: Blob;

    if (doc.fileData) {
      // Convert base64 back to binary data
      const base64Data = doc.fileData.split(',')[1]; // Remove data:mime;base64, prefix
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: doc.mimeType || 'application/octet-stream' });
    } else {
      // Fallback for text content
      const content = doc.content || '';
      blob = new Blob([content], { type: 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateDocumentType = (id: string, type: Document['type']) => {
    const updatedDocs = documents.map(doc =>
      doc.id === id ? { ...doc, type, lastModified: new Date() } : doc
    );
    saveDocuments(updatedDocs);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="document-manager">
      <h2>Document Manager</h2>
      
      <div className="controls">
        <div className="upload-section">
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.json,.csv,.xlsx"
            id="file-upload"
            disabled={isUploading}
          />
          <label htmlFor="file-upload" className="upload-button">
            {isUploading ? 'Uploading...' : 'Upload Documents'}
          </label>
        </div>

        <div className="search-section">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-section">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="type-filter"
          >
            <option value="all">All Types</option>
            <option value="policy">Policy</option>
            <option value="procedure">Procedure</option>
            <option value="form">Form</option>
            <option value="menu">Menu</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="documents-grid">
        {filteredDocuments.map((doc) => (
          <div key={doc.id} className="document-card">
            <div className="document-header">
              <h3>{doc.name}</h3>
              <div className="document-actions">
                <button
                  onClick={() => viewDocument(doc)}
                  className="action-button view-button"
                  title="View document"
                >
                  👁️
                </button>
                <button
                  onClick={() => downloadDocument(doc)}
                  className="action-button download-button"
                  title="Download document"
                >
                  📥
                </button>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="action-button delete-button"
                  title="Delete document"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className="document-meta">
              <select
                value={doc.type}
                onChange={(e) => updateDocumentType(doc.id, e.target.value as Document['type'])}
                className="type-selector"
              >
                <option value="policy">Policy</option>
                <option value="procedure">Procedure</option>
                <option value="form">Form</option>
                <option value="menu">Menu</option>
                <option value="other">Other</option>
              </select>
              
              <div className="dates">
                <small>Uploaded: {new Date(doc.uploadDate).toLocaleDateString()}</small>
                <small>Modified: {new Date(doc.lastModified).toLocaleDateString()}</small>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDocuments.length === 0 && (
        <div className="empty-state">
          <p>No documents found. Upload some documents to get started!</p>
        </div>
      )}

      {viewingDocument && (
        <div className="document-viewer-overlay" onClick={() => setViewingDocument(null)}>
          <div className="document-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="viewer-header">
              <h3>{viewingDocument.name}</h3>
              <div className="viewer-actions">
                <button
                  onClick={() => downloadDocument(viewingDocument)}
                  className="action-button download-button"
                  title="Download document"
                >
                  📥 Download
                </button>
                <button
                  onClick={() => setViewingDocument(null)}
                  className="action-button close-button"
                  title="Close viewer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="viewer-content">
              {viewingDocument.fileData ? (
                viewingDocument.mimeType?.startsWith('image/') ? (
                  <img src={viewingDocument.fileData} alt={viewingDocument.name} style={{ maxWidth: '100%', height: 'auto' }} />
                ) : viewingDocument.mimeType === 'application/pdf' ? (
                  <iframe src={viewingDocument.fileData} title={viewingDocument.name} style={{ width: '100%', height: '500px', border: 'none' }} />
                ) : viewingDocument.content ? (
                  <pre>{viewingDocument.content}</pre>
                ) : (
                  <div className="file-info">
                    <p><strong>File:</strong> {viewingDocument.name}</p>
                    <p><strong>Type:</strong> {viewingDocument.mimeType}</p>
                    <p><strong>Size:</strong> {viewingDocument.fileSize ? `${(viewingDocument.fileSize / 1024).toFixed(1)} KB` : 'Unknown'}</p>
                    <p>This file type cannot be previewed. Use download to view the file.</p>
                  </div>
                )
              ) : (
                <pre>{viewingDocument.content || 'No content available'}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManager;