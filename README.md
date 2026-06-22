# 🍌 Nano Banana Editor

**An AI-Powered Iterative Image Editor using Google's Gemini 2.5 Flash Image API**

![Next.js](https://img.shields.io/badge/Next.js-15.5.2-000000?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=flat-square&logo=tailwind-css)
![Google AI](https://img.shields.io/badge/Google%20AI-Gemini%202.5-4285F4?style=flat-square&logo=google)

## ✨ Features

- **🖼️ Smart Image Upload**: Drag & drop or click to upload thumbnails
- **🤖 AI-Powered Editing**: Uses Google's Gemini 2.5 Flash Image ("Nano Banana") API for intelligent image modifications
- **🔄 Iterative Workflow**: Each generated image becomes the new base for further editing
- **📚 Visual History**: Bottom timeline showing all previous versions with click-to-revert
- **⚡ Real-time Processing**: Async API calls with loading states and progress feedback
- **🎨 Modern UI**: Clean, responsive interface built with Tailwind CSS
- **🔒 Secure**: API keys managed through Google Cloud Secret Manager

## 🚀 How It Works

1. **Upload** a thumbnail image
2. **Describe** your desired changes in natural language
3. **Process** with AI - Nano Banana generates your edited image
4. **Iterate** - the result becomes your new base image for further edits
5. **Navigate** through your editing history and revert to any previous version

### Example Editing Session:
- Original: Photo of a person
- Edit 1: "make the hat black" → generates image with black hat
- Edit 2: "add sunglasses" → generates image with black hat + sunglasses  
- Edit 3: "change background to sunset" → generates final image with all modifications
- **Click any thumbnail** to revert to that version and continue editing from there

## 🛠️ Tech Stack

- **Framework**: Next.js 15.5.2 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI API**: Google Gemini 2.5 Flash Image ([@google/genai](https://www.npmjs.com/package/@google/genai))
- **Image Processing**: HTML5 Canvas + FileReader API
- **Deployment**: Vercel-ready

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud account with Generative AI API access
- Gemini API key

### Installation

```bash
# Clone the repository
git clone https://github.com/warpdotdev/nano-banana-editor.git
cd nano-banana-editor

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Google Generative AI API key to .env.local
```

### Environment Setup

Create a `.env.local` file:

```env
# Get your API key from: https://ai.google.dev/gemini-api/docs/api-key
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start editing images!

## 🏗️ Architecture

### Frontend (`/src/app/page.tsx`)
- React hooks for state management (image history, current image, loading states)
- File upload handling with drag & drop support
- Real-time form validation and submission
- Responsive image display with history timeline

### Backend (`/src/app/api/process-image/route.ts`)
- Next.js API route handling image processing requests
- Integration with Google Gemini 2.5 Flash Image API
- Base64 image encoding/decoding for API communication
- Error handling and response formatting

### Key Features Implementation

**Iterative Editing Workflow**:
```typescript
// After successful API response:
setSelectedImage(result.generatedImage);  // Replace current image
setImageHistory(prev => [...prev, previousImage]);  // Save to history
setInstructions("");  // Clear for next edit
```

**History Management**:
```typescript
// Click to revert truncates history (like git reset)
const revertToHistoryImage = (historyItem, index) => {
  setImageHistory(prev => prev.slice(0, index));  // Truncate
  setSelectedImage(historyItem.image);  // Revert
};
```

## 🎯 API Integration

The app integrates with Google's Gemini 2.5 Flash Image API ("Nano Banana"):

```typescript
const response = await genAI.models.generateContent({
  model: 'gemini-2.5-flash-image-preview',
  contents: [{
    parts: [
      { text: instructions },
      { inlineData: { mimeType: file.type, data: base64Data } }
    ]
  }]
});
```

## 🐛 Debugging Features

This project includes debugging capabilities using the Puppeteer MCP server:
- Live page inspection for UI bugs
- Real-time CSS debugging
- Image rendering diagnostics
- Console log monitoring

## 🌟 Recent Fixes

- **History Thumbnails**: Fixed black square rendering by correcting CSS overlay transparency
- **Stack Behavior**: Fixed history to properly truncate instead of append when reverting
- **Image Handling**: Improved data URL processing with regular `<img>` tags

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

Don't forget to add your `GOOGLE_GENERATIVE_AI_API_KEY` in the Vercel environment variables!

### Other Platforms

The app is a standard Next.js application and can be deployed to any platform that supports Node.js.

## 🤖 Automated Issue Workflows

This repository uses [Oz](https://warp.dev/oz) cloud agents to triage and implement GitHub issues automatically. Two GitHub Actions workflows power this:

- **Triage** (`.github/workflows/triage-issues.yml`): When a new issue is opened, an Oz agent reads the issue and codebase, then applies an implementation-readiness label. It follows the skill at `.agents/skills/Triage/SKILL.md`.
- **Implementation** (`.github/workflows/implement-ready-issues.yml`): When an issue is labeled **Ready to implement**, an Oz agent implements the smallest cohesive change, opens a pull request, and reports progress back on the issue. It follows the skill at `.agents/skills/implementation.md`.

### Setup

Both workflows require a `WARP_API_KEY` repository secret (your Oz API key). Optionally set a `WARP_AGENT_PROFILE` repository variable to pin a specific agent profile.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google AI team for the amazing Gemini 2.5 Flash Image API
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first styling approach

---

**Built with ❤️ by the Warp team**
