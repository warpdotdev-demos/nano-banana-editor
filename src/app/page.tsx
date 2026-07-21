"use client";

import Image from "next/image";
import { useRef, useState } from "react";

interface ImageHistoryItem {
  image: string;
  prompt: string;
  timestamp: number;
}

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [responseText, setResponseText] = useState<string | null>(null);

  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to convert data URL to File
  const dataURLtoFile = async (dataurl: string, filename: string): Promise<File> => {
    const response = await fetch(dataurl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };

  // Function to revert to a previous image from history
  const revertToHistoryImage = async (historyItem: ImageHistoryItem, index: number) => {
    try {
      // Truncate history to the selected point (pop everything after this index)
      setImageHistory(prev => prev.slice(0, index));
      
      // Set the selected history image as current
      setSelectedImage(historyItem.image);
      const newFile = await dataURLtoFile(historyItem.image, `reverted_${Date.now()}.png`);
      setSelectedFile(newFile);
      
      // Clear any messages and set instructions hint
      setSubmitMessage(`Reverted to image #${index + 1} - "${historyItem.prompt}"`);
      setInstructions("");
      setResponseText(null);
      
    } catch (error) {
      console.error('Error reverting to history image:', error);
      setSubmitMessage(`Error reverting to image #${index + 1}`);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setInstructions("");
    setSubmitMessage("");
    setImageHistory([]);
    setResponseText(null);
  };

  const handleReplaceImage = () => {
    replaceFileInputRef.current?.click();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!selectedFile || !instructions.trim()) {
      setSubmitMessage("Please provide both an image and instructions.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('instructions', instructions.trim());

      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitMessage(`Success! Image processed by Nano Banana (${result.originalImageSize} bytes)`);
        setResponseText(result.responseText);
        
        if (result.generatedImage) {
          // Add current image to history before replacing it
          if (selectedImage) {
            const historyItem: ImageHistoryItem = {
              image: selectedImage,
              prompt: instructions.trim(),
              timestamp: Date.now()
            };
            setImageHistory(prev => [...prev, historyItem]);
          }
          
          // Replace current image with generated result
          setSelectedImage(result.generatedImage);
          
          // Convert the generated image back to a File for future processing
          try {
            const newFile = await dataURLtoFile(result.generatedImage, `edited_${Date.now()}.png`);
            setSelectedFile(newFile);
          } catch (error) {
            console.error('Error converting generated image to file:', error);
          }
          
          // Clear instructions for next iteration
          setInstructions("");
        }
      } else {
        setSubmitMessage(`Error: ${result.error}`);
        setResponseText(null);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitMessage('Error: Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 ${imageHistory.length > 0 ? 'pb-32' : ''}`}>
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Image Upload
          </h1>
          <p className="text-gray-600">
            {selectedImage ? "Edit your thumbnail with instructions below" : "Select a thumbnail image from your computer"}
          </p>
        </div>

        <div className="space-y-8">
          {!selectedImage && (
            <div className="flex items-center justify-center">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span>
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          )}

          {selectedImage && (
            <div className="space-y-6">
              {/* Hidden file input for replacing the image */}
              <input
                ref={replaceFileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />

              <div className="flex justify-center">
                <div className="relative">
                  <Image
                    src={selectedImage}
                    alt="Uploaded thumbnail"
                    width={900}
                    height={900}
                    className="rounded-lg shadow-lg object-cover"
                    style={{ width: 'auto', height: 'auto', maxWidth: '900px', maxHeight: '900px' }}
                  />
                </div>
              </div>

              {/* Replace / Clear controls */}
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReplaceImage}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Replace image
                </button>
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear image
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">
                <div>
                  <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
                    Edit Instructions
                  </label>
                  <input
                    type="text"
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Describe how you want to edit this thumbnail..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                    disabled={isSubmitting}
                  />
                </div>
                
                {submitMessage && (
                  <div className={`p-3 rounded-lg text-sm ${submitMessage.startsWith('Success') 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    {submitMessage}
                  </div>
                )}
                
                <div className="flex justify-center">
                  <button
                    type="submit"
                    disabled={isSubmitting || !instructions.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Processing with Nano Banana...' : 'Process with AI'}
                  </button>
                </div>
              </form>
              
              {responseText && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mt-4">
                  <h4 className="font-medium text-blue-900 mb-2">Latest AI Response:</h4>
                  <p className="text-blue-800">{responseText}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Image History Strip */}
      {imageHistory.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Image History</h3>
            <div className="flex space-x-3 overflow-x-auto pb-2">
              {imageHistory.map((item, index) => (
                <div key={item.timestamp} className="flex-shrink-0">
                  <div 
                    className="w-20 h-20 relative group cursor-pointer hover:ring-2 hover:ring-blue-500 rounded-lg transition-all"
                    onClick={() => revertToHistoryImage(item, index)}
                    title={`Click to revert to: "${item.prompt}"`}
                  >
                    <img
                      src={item.image}
                      alt={`History ${index + 1}`}
                      className="w-full h-full rounded-lg object-cover"
                    />
                    <div className="absolute inset-0 bg-transparent group-hover:bg-black group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs opacity-0 group-hover:opacity-100 font-medium">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 text-center max-w-20 truncate">
                    {item.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
