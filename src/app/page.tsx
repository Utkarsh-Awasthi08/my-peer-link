'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import FileDownload from '@/components/FileDownload';
import InviteCode from '@/components/InviteCode';
import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [port, setPort] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'download'>('upload');
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleFileUpload = async (file: File) => {
    const MAX_FILE_SIZE_MB = 500;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`❌ File too large! Max ${MAX_FILE_SIZE_MB} MB allowed.`);
      // Clear the file input if possible (this depends on your FileUpload component)
      setUploadedFile(null);
      return; // Stop the function here
    }

    setUploadedFile(file);
    setIsUploading(true);
    setPort(null); // Reset previous port on new upload

    // Create a new AbortController for this upload
    const controller = new AbortController();


    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post("https://my-peer-link-backend-2.onrender.com/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        // The signal is what connects Axios to the AbortController
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      // No need for validateStatus, as non-2xx statuses will now throw an error
      // which we will catch below.

      setPort(response.data.port);
      toast.success("Upload Completed 🚀");

    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        // This will be logged if we manually cancel the upload, which we aren't
        // doing in this UI, but it's good practice to have.
        console.log("Upload canceled:", error.message);
      } else if (axios.isAxiosError(error)) {
        // Check if the error is an AxiosError
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 413) {
          toast.error("❌ File too large! Max 500 MB allowed.");
        } else {
          // Handle other server errors
          console.error("Error uploading file:", axiosError.message);
          toast.error("❌ Failed to upload. Please try again.");
        }
      } else {
        // Handle unexpected non-Axios errors
        console.error("An unexpected error occurred:", error);
        toast.error("❌ An unexpected error occurred.");
      }
    } finally {
      setIsUploading(false);
      setUploadedFile(null);

      setUploadProgress(0); // reset bar
    }
  };

  const handleDownload = async (port: number) => {
    setIsDownloading(true);

    try {
      const response = await axios.get(`https://my-peer-link-backend-2.onrender.com/download/${port}`, {
        responseType: 'blob',
      });

      // Get Content-Disposition
      const cd = response.headers['content-disposition'] || response.headers['Content-Disposition'] || '';

      let filename = 'download';
      const filenameStarMatch = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
      const filenameMatch = cd.match(/filename\s*=\s*"([^"]+)"/i) || cd.match(/filename\s*=\s*([^;]+)/i);

      if (filenameStarMatch && filenameStarMatch[1]) {
        // RFC 5987 decoding
        filename = decodeURIComponent(filenameStarMatch[1]);
      } else if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/["]/g, '');
      }

      // Create object URL directly from the blob
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);

      // Download via anchor
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Free memory
      setTimeout(() => URL.revokeObjectURL(url), 5000);

    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please check the invite code and try again.');
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-blue-600 mb-2">PeerLink</h1>
        <p className="text-xl text-gray-600">Secure P2P File Sharing</p>
      </header>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex border-b mb-6">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'upload'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab('upload')}
          >
            Share a File
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'download'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab('download')}
          >
            Receive a File
          </button>
        </div>

        {activeTab === 'upload' ? (
          <div>
            <FileUpload onFileUpload={handleFileUpload} isUploading={isUploading} />

            {uploadedFile && !isUploading && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">
                  Selected file: <span className="font-medium">{uploadedFile.name}</span> ({Math.round(uploadedFile.size / 1024)} KB)
                </p>
              </div>
            )}

            {isUploading && (
              <div className="mt-6 text-center">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-blue-500 h-4 transition-all duration-300 ease-in-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-gray-600">{uploadProgress}%</p>
              </div>
            )}

            <InviteCode port={port} />
          </div>
        ) : (
          <div>
            <FileDownload onDownload={handleDownload} isDownloading={isDownloading} />

            {isDownloading && (
              <div className="mt-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                <p className="mt-2 text-gray-600">Downloading file...</p>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>PeerLink &copy; {new Date().getFullYear()} - Secure P2P File Sharing</p>
      </footer>
    </div>
  );
}