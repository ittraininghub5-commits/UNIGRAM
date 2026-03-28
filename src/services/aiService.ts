import { supabase } from '@/src/lib/supabase';
import { GoogleGenAI, Type } from "@google/genai";
import { Quiz, QuizQuestion } from '@/src/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
const HUGGING_FACE_API_KEY = import.meta.env.VITE_HUGGING_FACE_API_KEY;

export interface AIInsight {
  id?: string;
  video_id: string;
  summary: string;
  key_takeaways: string[];
  created_at: string;
}

export async function getAIInsightForVideo(videoId: string): Promise<AIInsight | null> {
  try {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    return data as AIInsight | null;
  } catch (error) {
    console.error('Error fetching AI insight:', error);
    return null;
  }
}

export async function generateAIInsight(videoId: string, videoTitle: string, videoDescription: string): Promise<AIInsight> {
  if (!HUGGING_FACE_API_KEY) {
    throw new Error("Hugging Face API Key is missing. Please add VITE_HUGGING_FACE_API_KEY to your environment variables.");
  }

  const prompt = `Summarize the following educational video content and provide 3 key takeaways.\n\nTitle: ${videoTitle}\nDescription: ${videoDescription}`;

  try {
    const response = await fetch(HUGGING_FACE_API_URL, {
      headers: { Authorization: `Bearer ${HUGGING_FACE_API_KEY}` },
      method: "POST",
      body: JSON.stringify({ inputs: prompt }),
    });

    const result = await response.json();
    const summaryText = result[0]?.summary_text || "No summary generated.";
    const takeaways = summaryText.split('. ').slice(0, 3).map((s: string) => s.trim());

    const insightData: Omit<AIInsight, 'id'> = {
      video_id: videoId,
      summary: summaryText,
      key_takeaways: takeaways,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('ai_insights')
      .insert([insightData])
      .select()
      .single();

    if (error) throw error;
    return data as AIInsight;
  } catch (error) {
    console.error('Error generating AI insight:', error);
    throw error;
  }
}

export async function generateQuizFromContent(courseId: string, materialId: string | null, content: string): Promise<Quiz> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a 3-question quiz from the following educational content. Each question should have 4 options and one correct answer index (0-3). Return the response in JSON format.\n\nContent: ${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correct_answer: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] }
              },
              required: ["question", "options", "correct_answer"]
            }
          }
        },
        required: ["title", "questions"]
      }
    }
  });

  const quizData = JSON.parse(response.text);

  // 1. Create the quiz entry
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .insert([{
      course_id: courseId,
      material_id: materialId,
      title: quizData.title
    }])
    .select()
    .single();

  if (quizError) throw quizError;

  // 2. Create the questions
  const questionsToInsert = quizData.questions.map((q: any) => ({
    quiz_id: quiz.id,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    difficulty: q.difficulty || 'medium',
    ai_generated: true
  }));

  const { error: questionsError } = await supabase
    .from('quiz_questions')
    .insert(questionsToInsert);

  if (questionsError) throw questionsError;

  return { ...quiz, questions: questionsToInsert } as Quiz;
}

export async function generateTagsFromContent(content: string): Promise<string[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 5 relevant educational tags for the following content. Return the response in JSON format as an array of strings.\n\nContent: ${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text);
}
