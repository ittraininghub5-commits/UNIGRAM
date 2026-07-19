import { useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/lib/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Wand2, Loader, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface CourseFormData {
  title: string;
  description: string;
  tags: string[];
  thumbnail: File | null;
  level: 'beginner' | 'intermediate' | 'advanced';
}

interface AIGeneratedContent {
  modules: string[];
  outline: string;
  objectives: string[];
  resources: string[];
}

export default function NewCoursePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    tags: [],
    thumbnail: null,
    level: 'beginner',
  });
  const [currentTag, setCurrentTag] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiContent, setAiContent] = useState<AIGeneratedContent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'basic' | 'ai' | 'review'>('basic');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, title: e.target.value }));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, description: e.target.value }));
  };

  const handleAddTag = useCallback(() => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()],
      }));
      setCurrentTag('');
    }
  }, [currentTag, formData.tags]);

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, thumbnail: file }));
    }
  };

  const generateAIContent = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a course title');
      return;
    }

    try {
      setGenerating(true);
      
      // Call AI service to generate course structure
      const aiServiceUrl = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2/v1/chat/completions';
      const hfApiKey = import.meta.env.VITE_HUGGING_FACE_API_KEY;

      if (!hfApiKey) {
        toast.error('AI service not configured');
        setGenerating(false);
        return;
      }

      const prompt = `You are an expert course designer. Based on the following course information, generate a structured course plan.

Course Title: ${formData.title}
Description: ${formData.description}
Level: ${formData.level}
Tags: ${formData.tags.join(', ')}

Please provide a JSON response with the following structure:
{
  "modules": ["Module 1: ...", "Module 2: ...", ...],
  "outline": "Detailed course outline...",
  "objectives": ["Objective 1", "Objective 2", ...],
  "resources": ["Resource 1", "Resource 2", ...]
}

Generate 4-5 modules appropriate for a ${formData.level} level course.`;

      const response = await fetch(aiServiceUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistralai/Mistral-7B-Instruct-v0.2',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        throw new Error('AI generation failed');
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || '';
      
      // Parse JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setAiContent(parsed);
        setStep('ai');
        toast.success('Course structure generated');
      } else {
        throw new Error('Could not parse AI response');
      }
    } catch (err) {
      console.error('Error generating AI content:', err);
      toast.error('Failed to generate course structure. Try entering more details or try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!profile?.id) {
      toast.error('You must be logged in');
      return;
    }

    try {
      setSubmitting(true);

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (formData.thumbnail) {
        const fileName = `course-thumbnails/${profile.id}-${Date.now()}-${formData.thumbnail.name}`;
        const { error: uploadError } = await supabase.storage
          .from('course-materials')
          .upload(fileName, formData.thumbnail);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('course-materials')
          .getPublicUrl(fileName);

        thumbnailUrl = data.publicUrl;
      }

      // Create course
      const { data, error } = await supabase
        .from('courses')
        .insert({
          mentor_id: profile.id,
          title: formData.title,
          description: formData.description,
          tags: formData.tags,
          thumbnail_url: thumbnailUrl,
          status: 'draft',
          level: formData.level,
          module_count: aiContent?.modules.length || 0,
          video_count: 0,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Store AI-generated content as course metadata (you can extend this)
      if (aiContent && data) {
        // You could store this in a course_metadata table or course description
        console.log('AI Content for course:', aiContent);
      }

      toast.success('Course created! Redirecting to course editor...');
      setTimeout(() => {
        navigate(`/course/${data.id}`);
      }, 1000);
    } catch (err) {
      console.error('Error creating course:', err);
      toast.error('Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Create New Course</h1>
          <p className="text-text-muted">Use AI to help structure your course</p>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-8">
          {['basic', 'ai', 'review'].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-all ${
                step === s
                  ? 'bg-accent-teal'
                  : ['basic', 'ai'].includes(s) && ['ai', 'review'].includes(step)
                    ? 'bg-accent-teal/50'
                    : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 'basic' && (
          <div className="space-y-6">
            <div className="editorial-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4">Course Basics</h2>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={handleTitleChange}
                    placeholder="e.g., Advanced React Patterns"
                    className="w-full px-4 py-3 rounded-xl bg-bg-elevated border border-white/10 text-text-primary placeholder:text-text-muted focus:border-accent-teal/50 outline-none transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={handleDescriptionChange}
                    placeholder="Describe what students will learn..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-bg-elevated border border-white/10 text-text-primary placeholder:text-text-muted focus:border-accent-teal/50 outline-none transition-all"
                  />
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Course Level
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        level: e.target.value as CourseFormData['level'],
                      }))
                    }
                    className="w-full px-4 py-3 rounded-xl bg-bg-elevated border border-white/10 text-text-primary focus:border-accent-teal/50 outline-none transition-all"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add a tag and press Enter"
                      className="flex-1 px-4 py-2 rounded-xl bg-bg-elevated border border-white/10 text-text-primary placeholder:text-text-muted focus:border-accent-teal/50 outline-none transition-all text-sm"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 rounded-xl bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20 transition-all text-sm font-semibold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 text-accent-teal text-xs"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-accent-teal/70"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Thumbnail */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Course Thumbnail
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-bg-elevated border border-white/10 hover:border-accent-teal/30 cursor-pointer transition-all">
                      <Upload className="w-4 h-4 text-accent-teal" />
                      <span className="text-sm font-semibold text-text-primary">
                        {formData.thumbnail ? formData.thumbnail.name : 'Choose Image'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={generateAIContent}
              disabled={generating || !formData.title.trim() || !formData.description.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent-teal text-bg-base font-bold hover:bg-accent-teal/90 disabled:opacity-50 transition-all"
            >
              {generating ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating Course Structure...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate with AI
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: AI Generated Content */}
        {step === 'ai' && aiContent && (
          <div className="space-y-6">
            <div className="editorial-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4">AI-Generated Course Structure</h2>

              <div className="space-y-6">
                {/* Modules */}
                <div>
                  <h3 className="font-semibold text-text-primary mb-3">Modules</h3>
                  <ul className="space-y-2">
                    {aiContent.modules.map((module, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-bg-elevated rounded-xl">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-teal/20 text-accent-teal text-sm flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-text-primary">{module}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Objectives */}
                <div>
                  <h3 className="font-semibold text-text-primary mb-3">Learning Objectives</h3>
                  <ul className="space-y-2">
                    {aiContent.objectives.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-text-muted">
                        <span className="text-accent-teal">✓</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Outline */}
                <div>
                  <h3 className="font-semibold text-text-primary mb-3">Course Outline</h3>
                  <p className="text-text-muted whitespace-pre-wrap">{aiContent.outline}</p>
                </div>

                {/* Resources */}
                {aiContent.resources.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-text-primary mb-3">Recommended Resources</h3>
                    <ul className="space-y-2">
                      {aiContent.resources.map((resource, idx) => (
                        <li key={idx} className="text-text-muted">• {resource}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('basic')}
                className="flex-1 px-6 py-3 rounded-xl bg-white/10 text-text-primary font-bold hover:bg-white/15 transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                className="flex-1 px-6 py-3 rounded-xl bg-accent-teal text-bg-base font-bold hover:bg-accent-teal/90 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {step === 'review' && (
          <div className="space-y-6">
            <div className="editorial-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4">Review Course Details</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-text-muted mb-1">Title</p>
                  <p className="font-semibold text-text-primary">{formData.title}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Description</p>
                  <p className="text-text-primary whitespace-pre-wrap">{formData.description}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Level</p>
                  <p className="font-semibold text-text-primary capitalize">{formData.level}</p>
                </div>
                {formData.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-text-muted mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full bg-accent-teal/10 text-accent-teal text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('ai')}
                className="flex-1 px-6 py-3 rounded-xl bg-white/10 text-text-primary font-bold hover:bg-white/15 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleCreateCourse}
                disabled={submitting}
                className="flex-1 px-6 py-3 rounded-xl bg-green-500/20 text-green-300 font-bold hover:bg-green-500/30 disabled:opacity-50 transition-all"
              >
                {submitting ? 'Creating...' : 'Create Course'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
