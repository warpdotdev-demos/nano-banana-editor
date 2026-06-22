import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const instructions = formData.get('instructions') as string;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    if (!instructions) {
      return NextResponse.json({ error: 'No instructions provided' }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    // Get image bytes and convert to base64
    const imageBytes = await file.arrayBuffer();
    const imageSize = imageBytes.byteLength;
    const base64Data = Buffer.from(imageBytes).toString('base64');

    // Log to console for debugging
    console.log('User prompt:', instructions);
    console.log('Image size (bytes):', imageSize);
    console.log('Image name:', file.name);
    console.log('Image type:', file.type);

    // Call Nano Banana (Gemini image generation)
    console.log('Calling Nano Banana API...');
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          parts: [
            { text: instructions },
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    console.log('Nano Banana response received');

    // Process the response
    let generatedImageData: string | null = null;
    let responseText: string | null = null;

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        responseText = part.text;
        console.log('Response text:', part.text);
      } else if (part.inlineData) {
        generatedImageData = part.inlineData.data;
        console.log('Generated image received (base64 length):', part.inlineData.data?.length || 0);
      }
    }

    // Return the processed result
    return NextResponse.json({
      success: true,
      message: 'Image processed successfully by Nano Banana',
      originalImageSize: imageSize,
      instructions: instructions,
      responseText: responseText,
      generatedImage: generatedImageData ? `data:image/png;base64,${generatedImageData}` : null
    });

  } catch (error) {
    console.error('Error processing with Nano Banana:', error);
    return NextResponse.json(
      { error: 'Failed to process image with Nano Banana: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
