"use client";

import Image from "next/image";
import { useState } from "react";

interface ImageHistoryItem {
  image: string;
  prompt: string;
  timestamp: number;
}

type MessageKind = "success" | "error" | "info";

interface StatusMessage {
  kind: MessageKind;
  text: string;
}

const MESSAGE_STYLES: Record<MessageKind, string> = {
  success: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  error: "bg-red-50 text-red-700 border border-red-200",
  info: "bg-blue-50 text-blue-700 border border-blue-200",
};

const MESSAGE_ICONS: Record<MessageKind, string> = {
  success: "✅",
  error: "⚠️",
  info: "ℹ️",
};

const NANO_BANANA_REPO_URL = "https://github.com/warpdotdev-demos/nano-banana-editor";
const CLOUD_FACTORY_REPO_URL = "https://github.com/warpdotdev-demos/cloud-factory-demo";
const WARP_URL = "https://warp.dev";

// Vercel rejects serverless function request bodies larger than 4.5 MB with a
// 413 before the route handler ever runs, so the API cannot return a useful
// error. Guard on the client with headroom for multipart form overhead.
//
// Note that the same 4.5 MB cap also applies to the *response* body, which this
// guard cannot prevent: the route returns the generated image as base64 JSON
// (~1.33x the binary size), and the size of a generated image is not a function
// of the size of the input. See the README's deployment notes.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_LABEL = "4MB";

const formatBytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(2)}MB`;

// Returns an error message when the file is too large to send, otherwise null.
const getSizeError = (file: File): string | null =>
  file.size > MAX_IMAGE_BYTES
    ? `Image is too large (${formatBytes(file.size)}). The maximum upload size is ${MAX_IMAGE_LABEL}.`
    : null;

// A small, self-authored terminal-prompt glyph used to attribute this demo to
// Warp without embedding any official Warp brand asset.
function WarpMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      role="img"
      aria-label="Warp"
      className="shrink-0 rounded-md"
    >
      <defs>
        <linearGradient id="warpMarkGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="55%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="7" fill="url(#warpMarkGradient)" />
      <path
        d="M8 9l4.5 5-4.5 5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M14.5 19h6" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur supports-backdrop-blur:bg-white/60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <a
          href={WARP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          <WarpMark />
          <span>Warp</span>
          <span className="text-slate-300">/</span>
          <span className="font-normal text-slate-500">Cloud Factory Demo</span>
        </a>
        <nav aria-label="Project repositories" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <a
            href={NANO_BANANA_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 hover:decoration-slate-500"
          >
            Nano Banana Editor repo
          </a>
          <a
            href={CLOUD_FACTORY_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 hover:decoration-slate-500"
          >
            Cloud Factory Demo repo
          </a>
        </nav>
      </div>
    </header>
  );
}

function LandingHero() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-2 pt-12 text-center sm:px-8 sm:pt-16">
      <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
        <span aria-hidden="true">🏭</span> Built end-to-end by Warp&apos;s Cloud Factory
      </p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        🍌 Nano Banana Editor
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
        Upload a photo, describe an edit in plain English, and Google&apos;s Gemini &ldquo;Nano
        Banana&rdquo; image model rewrites it — then keep iterating on the result, edit after edit.
      </p>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
        This app is a public demo for{" "}
        <a
          href={CLOUD_FACTORY_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
        >
          Warp&apos;s Cloud Factory
        </a>
        , an autonomous agent factory that triages issues, writes specs, ships code, and reviews
        pull requests with no human in the loop. Its source lives in the{" "}
        <a
          href={NANO_BANANA_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
        >
          nano-banana-editor
        </a>{" "}
        repository.
      </p>
    </section>
  );
}

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [responseText, setResponseText] = useState<string | null>(null);

  const messageClasses = statusMessage
    ? `flex items-start gap-2 p-3 rounded-lg text-sm ${MESSAGE_STYLES[statusMessage.kind]}`
    : "";

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
      setStatusMessage({ kind: "info", text: `Reverted to image #${index + 1} - "${historyItem.prompt}"` });
      setInstructions("");
      setResponseText(null);

    } catch (error) {
      console.error('Error reverting to history image:', error);
      setStatusMessage({ kind: "error", text: `Error reverting to image #${index + 1}` });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const sizeError = getSizeError(file);
      if (sizeError) {
        // Allow re-selecting the same file after the error is shown.
        event.target.value = "";
        setSelectedFile(null);
        setSelectedImage(null);
        setStatusMessage({ kind: "error", text: `${sizeError} Please choose a smaller image.` });
        return;
      }

      setStatusMessage(null);
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
      setStatusMessage({ kind: "error", text: "Please provide both an image and instructions." });
      return;
    }

    // Catch every path into the API (initial upload, generated result, revert)
    // before the request leaves the browser.
    const sizeError = getSizeError(selectedFile);
    if (sizeError) {
      setStatusMessage({
        kind: "error",
        text: `${sizeError} Revert to an earlier image in the History strip below, or reload to start over.`,
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

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
        setStatusMessage({
          kind: "success",
          text: `Nano Banana processed your image (${result.originalImageSize} bytes).`,
        });
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

            // Each generated PNG becomes the next request's input, so the
            // payload can grow across iterations. Warn as soon as the result
            // exceeds the limit instead of failing on the next submit.
            const nextSizeError = getSizeError(newFile);
            if (nextSizeError) {
              setStatusMessage({
                kind: "error",
                text: `${nextSizeError} This result is too large to edit further - revert to an earlier image in the History strip below, or reload to start over.`,
              });
            }
          } catch (error) {
            console.error('Error converting generated image to file:', error);
          }

          // Clear instructions for next iteration
          setInstructions("");
        }
      } else {
        // result.error is already a friendly, human-readable message from the
        // API (see src/lib/gemini-errors.ts) - safe to render verbatim.
        setStatusMessage({ kind: "error", text: result.error ?? "Something went wrong. Please try again." });
        setResponseText(null);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setStatusMessage({ kind: "error", text: "Failed to submit the request. Please check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <SiteHeader />

      {!selectedImage && <LandingHero />}

      <div className={`mx-auto w-full max-w-4xl px-4 pb-16 sm:px-8 ${imageHistory.length > 0 ? "pb-32" : ""} ${selectedImage ? "pt-12 sm:pt-16" : "pt-8"}`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60 sm:p-10">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">
              {selectedImage ? "Edit your image" : "Upload an image to get started"}
            </h2>
            <p className="text-sm text-slate-500">
              {selectedImage
                ? "Describe how you'd like to change it, then process with AI."
                : `Select an image from your computer (PNG, JPG, or GIF, up to ${MAX_IMAGE_LABEL}).`}
            </p>
          </div>

          <div className="space-y-8 mt-8">
            {!selectedImage && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-4 text-slate-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="mb-2 text-sm text-slate-500">
                        <span className="font-semibold">Click to upload</span>
                      </p>
                      <p className="text-xs text-slate-500">PNG, JPG, GIF up to {MAX_IMAGE_LABEL}</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>

                {statusMessage && (
                  <div className={`max-w-2xl mx-auto ${messageClasses}`} role="status">
                    <span aria-hidden="true">{MESSAGE_ICONS[statusMessage.kind]}</span>
                    <span>{statusMessage.text}</span>
                  </div>
                )}
              </div>
            )}

            {selectedImage && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="relative">
                    <Image
                      src={selectedImage}
                      alt="Currently selected image being edited"
                      width={900}
                      height={900}
                      className="rounded-lg shadow-lg object-cover"
                      style={{ width: 'auto', height: 'auto', maxWidth: '90px', maxHeight: '90px' }}
                    />
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">
                  <div>
                    <label htmlFor="instructions" className="block text-sm font-medium text-slate-700 mb-2">
                      Edit Instructions
                    </label>
                    <input
                      type="text"
                      id="instructions"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Describe how you want to edit this image..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-colors"
                      disabled={isSubmitting}
                    />
                  </div>

                  {statusMessage && (
                    <div className={messageClasses} role="status">
                      <span aria-hidden="true">{MESSAGE_ICONS[statusMessage.kind]}</span>
                      <span>{statusMessage.text}</span>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <button
                      type="submit"
                      disabled={isSubmitting || !instructions.trim()}
                      className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Processing with Nano Banana...' : 'Process with AI'}
                    </button>
                  </div>
                </form>

                {responseText && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mt-4 max-w-2xl mx-auto">
                    <h3 className="font-medium text-blue-900 mb-2">Latest AI Response:</h3>
                    <p className="text-blue-800">{responseText}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image History Strip */}
      {imageHistory.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Image History</h3>
            <div className="flex space-x-3 overflow-x-auto pb-2">
              {imageHistory.map((item, index) => (
                <div key={item.timestamp} className="flex-shrink-0">
                  <div
                    className="w-20 h-20 relative group cursor-pointer hover:ring-2 hover:ring-violet-500 rounded-lg transition-all"
                    onClick={() => revertToHistoryImage(item, index)}
                    title={`Click to revert to: "${item.prompt}"`}
                  >
                    <img
                      src={item.image}
                      alt={`Edit history step ${index + 1}: ${item.prompt}`}
                      className="w-full h-full rounded-lg object-cover"
                    />
                    <div className="absolute inset-0 bg-transparent group-hover:bg-black group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs opacity-0 group-hover:opacity-100 font-medium">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 text-center max-w-20 truncate">
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
