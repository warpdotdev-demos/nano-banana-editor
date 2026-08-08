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

1. **Import the project** on [vercel.com/new](https://vercel.com/new) (or run `vercel link` locally), pointing it at this repository.
2. **Set the environment variable** for each environment you plan to use (Production, Preview, and Development): add `GOOGLE_GENERATIVE_AI_API_KEY` under Project Settings → Environment Variables. See [`.env.example`](.env.example) for the expected shape.
3. **Node version**: the project pins `engines.node` to `>=20` in `package.json`; Vercel will use a matching Node major automatically.
4. **Function timeout**: `src/app/api/process-image/route.ts` sets `export const maxDuration = 300` (seconds) since Gemini image generation can take longer than the platform default. 300s is the current maximum on the Hobby plan and is also valid on Pro/Enterprise.
5. **Build**: Vercel runs `npm run build`, which invokes `next build --turbopack` (the same command used for local production builds).
6. **Deploy**: push to your linked Git branch, or run:
   ```bash
   npm run build
   vercel --prod
   ```

**Upload size limit**: Vercel caps serverless function request bodies at 4.5 MB. The UI enforces a 4MB client-side limit (see `MAX_UPLOAD_BYTES` in `src/app/page.tsx`) to stay safely under that platform cap, including for images regenerated during iterative editing.

### Other Platforms

The app is a standard Next.js application and can be deployed to any platform that supports Node.js 20+.

## 🤖 Cloud Factory Automation

This repository consumes Cloud Factory skills from the canonical [`warpdotdev-demos/cloud-factory-demo`](https://github.com/warpdotdev-demos/cloud-factory-demo) repository.

To install or refresh the Triage and Implementation skills and workflow templates locally, run:

```bash
./scripts/bootstrap-cloud-factory.sh
```

The bootstrap script uses `npx skills install` to install the canonical skills into this repo and copies the workflow templates from `cloud-factory-demo`. Configure the `WARP_API_KEY` GitHub Actions secret before enabling the workflows.

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
