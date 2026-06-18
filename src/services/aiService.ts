import { supabase } from '@/src/lib/supabase';
import { Quiz } from '@/src/types';

const HUGGING_FACE_SUMMARY_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
const HUGGING_FACE_TEXT_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large";
const HUGGING_FACE_API_KEY = import.meta.env.VITE_HUGGING_FACE_API_KEY;
const AI_INSIGHT_CACHE_TTL_MS = 5 * 60 * 1000;
const aiInsightCache = new Map<string, { value: AIInsight | null; expiresAt: number }>();
const inflightAiInsightRequests = new Map<string, Promise<AIInsight | null>>();

export interface AIInsight {
  id?: string;
  video_id: string;
  summary: string;
  key_takeaways: string[];
  created_at: string;
}

export interface GeneratedQuizDraft {
  title: string;
  questions: Array<{
    question: string;
    options: string[];
    correct_answer: number;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

export async function generateCourseMetadataFromTitle(title: string): Promise<{ description: string; tags: string[] }> {
  const cleanedTitle = title.trim();
  if (!cleanedTitle) {
    return { description: '', tags: [] };
  }

  const fallbackDescription = `This course explores ${cleanedTitle} through practical examples, guided learning, and hands-on exercises.`;
  const fallbackTags = extractFallbackTags(cleanedTitle, 5);

  if (HUGGING_FACE_API_KEY) {
    const prompt = [
      'Create concise course metadata for the given title.',
      'Return valid JSON only with shape:',
      '{"description":"string","tags":["string","string","string","string","string"]}',
      `Title: ${cleanedTitle}`,
    ].join('\n');

    try {
      const result = await callHuggingFace(HUGGING_FACE_TEXT_URL, prompt);
      const generatedText = extractGeneratedText(result);
      const parsed = parseJsonFromText(generatedText);

      if (parsed && typeof parsed === 'object') {
        const description = String(parsed.description || '').trim() || fallbackDescription;
        const tags = Array.isArray(parsed.tags)
          ? parsed.tags.map((tag: any) => String(tag).trim().toLowerCase()).filter(Boolean).slice(0, 5)
          : fallbackTags;

        return {
          description,
          tags: tags.length > 0 ? tags : fallbackTags,
        };
      }
    } catch (error) {
      console.warn('Hugging Face course metadata generation failed, using fallback metadata.', error);
    }
  }

  return {
    description: fallbackDescription,
    tags: fallbackTags,
  };
}

function buildFallbackInsight(videoTitle: string, videoDescription?: string | null): { summary: string; key_takeaways: string[] } {
  const source = `${videoTitle}. ${videoDescription || ''}`.trim();
  const normalized = source.replace(/\s+/g, ' ');
  const sentences = normalized
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const summary =
    sentences.slice(0, 2).join('. ') ||
    `This lesson covers key learning points from ${videoTitle}.`;

  const takeaways = (sentences.length ? sentences : [summary])
    .slice(0, 3)
    .map((line) => line.slice(0, 140));

  while (takeaways.length < 3) {
    takeaways.push(`Review ${videoTitle} and practice the main concept.`);
  }

  return { summary, key_takeaways: takeaways };
}

export async function getAIInsightForVideo(videoId: string): Promise<AIInsight | null> {
  const now = Date.now();
  const cached = aiInsightCache.get(videoId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached) {
    aiInsightCache.delete(videoId);
  }

  const inflight = inflightAiInsightRequests.get(videoId);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      const value = data as AIInsight | null;
      aiInsightCache.set(videoId, {
        value,
        expiresAt: now + AI_INSIGHT_CACHE_TTL_MS,
      });
      return value;
    } catch (error) {
      console.error('Error fetching AI insight:', error);
      return null;
    } finally {
      inflightAiInsightRequests.delete(videoId);
    }
  })();

  inflightAiInsightRequests.set(videoId, request);
  return request;
}

export async function generateAIInsight(videoId: string, videoTitle: string, videoDescription?: string | null): Promise<AIInsight> {
  const prompt = `Summarize the following educational video content and provide 3 key takeaways.\n\nTitle: ${videoTitle}\nDescription: ${videoDescription}`;
  const fallback = buildFallbackInsight(videoTitle, videoDescription);
  let summaryText = fallback.summary;
  let takeaways = fallback.key_takeaways;

  try {
    if (HUGGING_FACE_API_KEY) {
      const response = await fetch(HUGGING_FACE_SUMMARY_URL, {
        headers: {
          Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ inputs: prompt }),
      });

      if (!response.ok) {
        throw new Error(`Hugging Face summary request failed: ${response.status}`);
      }

      const result = await response.json();
      const candidate = result?.[0]?.summary_text || result?.summary_text;
      if (candidate && typeof candidate === 'string') {
        summaryText = candidate.trim();
        takeaways = summaryText
          .split(/[.!?]+/)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .slice(0, 3);
      }
    }

    if (!takeaways.length) {
      takeaways = fallback.key_takeaways;
    }

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

    if (error) {
      // Students may not have INSERT permission; still return generated insight for immediate UI use.
      return insightData;
    }

    return data as AIInsight;
  } catch (error) {
    console.error('Error generating AI insight:', error);
    return {
      video_id: videoId,
      summary: fallback.summary,
      key_takeaways: fallback.key_takeaways,
      created_at: new Date().toISOString(),
    };
  }
}

export async function generateQuizDraftFromContent(content: string, questionCount: number = 3): Promise<GeneratedQuizDraft> {
  const safeQuestionCount = Math.min(10, Math.max(1, Math.round(questionCount || 3)));
  let quizData: any | null = null;

  if (HUGGING_FACE_API_KEY) {
    const prompt = [
      "Generate a quiz from the content below.",
      "Return valid JSON only with shape:",
      '{"title":"string","questions":[{"question":"string","options":["string","string","string","string"],"correct_answer":0,"explanation":"string","difficulty":"easy|medium|hard"}]}',
      `Generate exactly ${safeQuestionCount} questions.`,
      "Each question must be multiple choice with exactly 4 options.",
      `Content: ${content.slice(0, 3500)}`,
    ].join("\n");

    try {
      const result = await callHuggingFace(HUGGING_FACE_TEXT_URL, prompt);
      const generatedText = extractGeneratedText(result);
      quizData = parseJsonFromText(generatedText);
    } catch (error) {
      console.warn('Hugging Face quiz generation failed, using fallback quiz generation.', error);
    }
  }

  return normalizeQuizData(quizData, content, safeQuestionCount);
}

export async function createQuizFromDraft(courseId: string, materialId: string | null, draft: GeneratedQuizDraft): Promise<Quiz> {
  const normalizedDraft = normalizeQuizData(draft, JSON.stringify(draft), draft.questions.length || 3);
  
  try {
    // 1. Create the quiz entry
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert([{
        course_id: courseId,
        material_id: materialId,
        title: normalizedDraft.title
      }])
      .select()
      .single();

    if (quizError) throw quizError;

    // 2. Create the questions
    const questionsToInsert = normalizedDraft.questions.map((q) => ({
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

    if (questionsError) {
      // Attempt to cleanup the orphaned quiz
      await supabase.from('quizzes').delete().eq('id', quiz.id);
      throw questionsError;
    }

    return { ...quiz, questions: questionsToInsert } as Quiz;
  } catch (error) {
    console.error('Quiz creation failed:', error);
    throw error;
  }
}

export async function generateQuizFromContent(
  courseId: string,
  materialId: string | null,
  content: string,
  questionCount: number = 3
): Promise<Quiz> {
  const draft = await generateQuizDraftFromContent(content, questionCount);
  return createQuizFromDraft(courseId, materialId, draft);
}

export async function generateTagsFromContent(content: string): Promise<string[]> {
  if (HUGGING_FACE_API_KEY) {
    const prompt = [
      "Extract exactly 5 educational topic tags from this content.",
      "Return only a JSON array of strings.",
      `Content: ${content.slice(0, 2000)}`,
    ].join("\n");

    try {
      const result = await callHuggingFace(HUGGING_FACE_TEXT_URL, prompt);
      const generatedText = extractGeneratedText(result);
      const parsed = parseJsonFromText(generatedText);

      if (Array.isArray(parsed)) {
        return parsed
          .map((tag) => String(tag).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 5);
      }
    } catch (error) {
      console.warn('Hugging Face tag generation failed, using fallback tags.', error);
    }
  }

  return extractFallbackTags(content, 5);
}

async function callHuggingFace(modelUrl: string, prompt: string): Promise<any> {
  if (!HUGGING_FACE_API_KEY) {
    throw new Error('Hugging Face API Key is missing.');
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 512,
          temperature: 0.2,
          return_full_text: false,
        },
      }),
    });

    if (response.ok) {
      return response.json();
    }

    if ((response.status === 429 || response.status === 503) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      continue;
    }

    throw new Error(`Hugging Face request failed: ${response.status}`);
  }

  throw new Error('Hugging Face request failed after retries');
}

function extractGeneratedText(result: any): string {
  if (Array.isArray(result) && result[0]?.generated_text) {
    return String(result[0].generated_text);
  }
  if (result?.generated_text) {
    return String(result.generated_text);
  }
  if (Array.isArray(result) && result[0]?.summary_text) {
    return String(result[0].summary_text);
  }
  return JSON.stringify(result || '');
}

function parseJsonFromText(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObject = cleaned.indexOf('{');
    const lastObject = cleaned.lastIndexOf('}');
    if (firstObject !== -1 && lastObject > firstObject) {
      try {
        return JSON.parse(cleaned.slice(firstObject, lastObject + 1));
      } catch {
        // Continue to array parsing
      }
    }

    const firstArray = cleaned.indexOf('[');
    const lastArray = cleaned.lastIndexOf(']');
    if (firstArray !== -1 && lastArray > firstArray) {
      try {
        return JSON.parse(cleaned.slice(firstArray, lastArray + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function normalizeQuizData(rawQuizData: any, content: string, questionCount: number): GeneratedQuizDraft {
  const safeQuestionCount = Math.min(10, Math.max(1, Math.round(questionCount || 3)));

  if (rawQuizData && typeof rawQuizData === 'object' && Array.isArray(rawQuizData.questions) && rawQuizData.questions.length > 0) {
    const title = String(rawQuizData.title || 'AI Generated Quiz').slice(0, 120);

    const questions = rawQuizData.questions.slice(0, safeQuestionCount).map((q: any, index: number) => {
      const rawOptions = Array.isArray(q?.options) ? q.options.map((opt: any) => String(opt).trim()).filter(Boolean) : [];
      const options = [...rawOptions];
      while (options.length < 4) {
        options.push(`Option ${options.length + 1}`);
      }

      const rawCorrect = Number(q?.correct_answer);
      const correctAnswer = Number.isFinite(rawCorrect) && rawCorrect >= 0 && rawCorrect < options.length ? rawCorrect : 0;
      const difficulty = q?.difficulty === 'easy' || q?.difficulty === 'hard' ? q.difficulty : 'medium';

      return {
        question: String(q?.question || `Question ${index + 1}`).trim(),
        options: options.slice(0, 4),
        correct_answer: correctAnswer,
        explanation: String(q?.explanation || 'Review the source material for this concept.').trim(),
        difficulty,
      };
    });

    if (questions.length === safeQuestionCount) {
      return { title, questions };
    }

    const fallback = buildFallbackQuiz(content, safeQuestionCount);
    return {
      title,
      questions: [...questions, ...fallback.questions].slice(0, safeQuestionCount),
    };
  }

  return buildFallbackQuiz(content, safeQuestionCount);
}

function buildFallbackQuiz(content: string, questionCount: number): GeneratedQuizDraft {
  const sentences = content
    .replace(/\s+/g, ' ')
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  const pool = sentences.length > 0 ? sentences : ['This material focuses on core learning concepts and practical understanding.'];
  const questions = Array.from({ length: questionCount }).map((_, i) => {
    const correctText = pool[i % pool.length];
    const distractors = pool
      .filter((s) => s !== correctText)
      .slice(0, 3)
      .map((s) => `Not this: ${s.slice(0, 60)}...`);

    const options = [correctText.slice(0, 90), ...distractors];
    while (options.length < 4) {
      options.push(`Concept option ${options.length + 1}`);
    }

    return {
      question: `Which statement best matches key idea ${i + 1}?`,
      options: options.slice(0, 4),
      correct_answer: 0,
      explanation: 'The correct option reflects the source content summary.',
      difficulty: (i === 0 ? 'easy' : i === 1 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard',
    };
  });

  return {
    title: 'AI Generated Quiz',
    questions,
  };
}

function extractFallbackTags(content: string, count: number): string[] {
  const stopwords = new Set([
    'the', 'and', 'for', 'that', 'with', 'this', 'from', 'are', 'was', 'were', 'have', 'has', 'had',
    'you', 'your', 'about', 'into', 'their', 'there', 'what', 'when', 'where', 'which', 'will', 'would',
    'could', 'should', 'can', 'not', 'but', 'also', 'than', 'then', 'them', 'they', 'our', 'out', 'all',
    'how', 'why', 'use', 'using', 'used', 'its', 'while', 'each', 'such', 'more', 'most', 'over',
    'under', 'after', 'before', 'between', 'been', 'being', 'only', 'very', 'just', 'like', 'into', 'through'
  ]);

  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !stopwords.has(w));

  const frequencies = new Map<string, number>();
  words.forEach((word) => {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  });

  const sorted = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, count);

  if (sorted.length > 0) {
    return sorted;
  }

  return ['education', 'learning', 'course', 'practice', 'skills'].slice(0, count);
}
