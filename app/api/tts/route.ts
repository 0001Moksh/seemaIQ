import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json();
    if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Aoede" } },
        },
      },
    });

    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) return NextResponse.json({ error: "No audio returned" }, { status: 500 });

    const audioBuffer = Buffer.from(base64, "base64");

    return new Response(audioBuffer, {
      status: 200,
      headers: { "Content-Type": "audio/wav", "Content-Length": audioBuffer.length.toString() },
    });

  } catch (err: any) {
    console.error("TTS Error:", err);
    return NextResponse.json({ error: err.message || "TTS failed" }, { status: 500 });
  }
}
