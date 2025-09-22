import React, { useState, useEffect } from 'react';
import { Document } from '../../types';
import './DocumentManager.css';

const DocumentManager: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);

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
          content: e.target?.result as string,
          uploadDate: new Date(),
          lastModified: new Date(),
        };
        newDocuments.push(newDoc);

        if (newDocuments.length === files.length) {
          saveDocuments([...documents, ...newDocuments]);
          setIsUploading(false);
        }
      };
      reader.readAsText(file);
    });
  };

  const deleteDocument = (id: string) => {
    const updatedDocs = documents.filter(doc => doc.id !== id);
    saveDocuments(updatedDocs);
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
            accept=".txt,.pdf,.doc,.docx"
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
              <button
                onClick={() => deleteDocument(doc.id)}
                className="delete-button"
              >
                ×
              </button>
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

            {doc.content && (
              <div className="document-preview">
                <p>{doc.content.substring(0, 200)}...</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredDocuments.length === 0 && (
        <div className="empty-state">
          <p>No documents found. Upload some documents to get started!</p>
        </div>
      )}
    </div>
  );
};

export default DocumentManager;