import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GeminiMissingApiKeyError, detectSafetyBlock, mapGeminiError } from '@/lib/gemini-errors';

const genAI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
});

// The Gemini image call is awaited synchronously, so the request stays open for
// the whole generation. Run on the Node.js runtime (the Edge runtime cannot be
// used with the @google/genai SDK's Node dependencies) and raise the function
// timeout.
//
// 300s is the maximum duration allowed on Vercel's Hobby plan (and the default
// on Pro/Enterprise, which allow more), so this value is valid on every plan.
// Note: Hobby only reaches 300s with fluid compute, which is enabled by default
// for new projects. On a legacy project with fluid compute disabled the ceiling
// is 60s and the build will reject this value — lower it to 60 if that happens.
export const runtime = 'nodejs';
export const maxDuration = 300;

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
      // Thrown (rather than returned directly) so it goes through the same
      // mapGeminiError() mapping - and gets the same user-facing wording - as
      // an invalid key rejected by the Gemini API itself.
      throw new GeminiMissingApiKeyError();
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
        generatedImageData = part.inlineData.data ?? null;
        console.log('Generated image received (base64 length):', part.inlineData.data?.length || 0);
      }
    }

    // Gemini doesn't throw when it blocks a response for safety reasons - it
    // returns a normal 200 with promptFeedback.blockReason and/or a
    // finishReason on the (empty) candidate instead. Surface that the same
    // way as any other failure by routing it through the shared error
    // mapping, rather than reporting a false "success" with no image.
    const safetyBlock = detectSafetyBlock(response, Boolean(generatedImageData));
    if (safetyBlock) {
      throw safetyBlock;
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
    // Always log the full, raw error server-side (visible in Vercel logs) so
    // it stays debuggable - only the response sent to the client is sanitised.
    console.error('Error processing with Nano Banana:', error);

    const { status, message, kind, retryDelaySeconds } = mapGeminiError(error);
    return NextResponse.json(
      { error: message, errorKind: kind, retryDelaySeconds },
      { status }
    );
  }
}
