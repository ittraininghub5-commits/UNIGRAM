import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Zap, ChevronRight, Upload, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface QuizQuestion {
  id: string;
  question: string;
  type: 'mcq' | 'text' | 'matching' | 'image';
  options?: string[];
  image_url?: string;
  correct_answer?: string | number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface QuizState {
  currentQuestion: number;
  answers: Record<string, any>;
  submitted: boolean;
  score: number;
  feedback: Record<string, string>;
}

export function QuizPage() {
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: 0,
    answers: {},
    submitted: false,
    score: 0,
    feedback: {}
  });
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchQuiz();
  }, []);

  const fetchQuiz = async () => {
    try {
      // Get quiz from URL or props
      const quizId = new URLSearchParams(window.location.search).get('quiz_id');
      if (!quizId) return;

      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          id,
          title,
          course_id,
          quiz_questions (
            id,
            question,
            options,
            difficulty,
            explanation
          )
        `)
        .eq('id', quizId)
        .single();

      if (error) throw error;

      setQuiz(data);
      setQuestions(data.quiz_questions || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching quiz:', error);
      setLoading(false);
    }
  };

  const handleAnswer = (value: any) => {
    setQuizState(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questions[prev.currentQuestion].id]: value
      }
    }));
  };

  const handleNext = () => {
    if (quizState.currentQuestion < questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1
      }));
    }
  };

  const handlePrevious = () => {
    if (quizState.currentQuestion > 0) {
      setQuizState(prev => ({
        ...prev,
        currentQuestion: prev.currentQuestion - 1
      }));
    }
  };

  const handleSubmit = async () => {
    setVerifying(true);
    try {
      // Verify answers with AI for text/matching questions
      const verified = await verifyAnswersWithAI();
      
      const score = Object.values(quizState.answers).filter((_, i) => {
        return verified[questions[i].id]?.correct || false;
      }).length;

      setQuizState(prev => ({
        ...prev,
        submitted: true,
        score: (score / questions.length) * 100,
        feedback: verified
      }));

      // Save quiz result
      const user = (await supabase.auth.getUser()).data.user;
      if (user && score >= questions.length * 0.7) {
        // Award certificate if passed (70%)
        await supabase
          .from('certificates')
          .insert([{
            student_id: user.id,
            mentor_id: quiz.mentor_id,
            course_id: quiz.course_id,
            verification_code: `BADGE-${Date.now()}`
          }]);
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
    } finally {
      setVerifying(false);
    }
  };

  const verifyAnswersWithAI = async () => {
    // Mock AI verification - in production, call your AI service
    const feedback: Record<string, any> = {};
    
    questions.forEach((q, index) => {
      const answer = quizState.answers[q.id];
      const isCorrect = answer === q.correct_answer;
      
      feedback[q.id] = {
        correct: isCorrect,
        suggestion: isCorrect ? "Great answer!" : "Try to review this topic"
      };
    });

    return feedback;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <Zap className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-50" />
          <p className="text-slate-400">No quiz found</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[quizState.currentQuestion];
  const isAnswered = quizState.answers[currentQuestion.id] !== undefined;
  const progress = ((quizState.currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6 md:p-8">
      {!quizState.submitted ? (
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">{quiz.title}</h1>
            <p className="text-slate-400">Question {quizState.currentQuestion + 1} of {questions.length}</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl p-8 mb-8">
            {/* Question */}
            <h2 className="text-2xl font-bold mb-6">{currentQuestion.question}</h2>

            {/* Question Type Specific UI */}
            {currentQuestion.type === 'mcq' && (
              <div className="space-y-3">
                {currentQuestion.options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      quizState.answers[currentQuestion.id] === idx
                        ? 'bg-cyan-500/20 border-cyan-500'
                        : 'bg-slate-700/20 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        quizState.answers[currentQuestion.id] === idx
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'border-slate-500'
                      }`}>
                        {quizState.answers[currentQuestion.id] === idx && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'text' && (
              <div>
                <textarea
                  value={quizState.answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full p-4 bg-slate-700/20 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
                  rows={6}
                />
              </div>
            )}

            {currentQuestion.type === 'image' && (
              <div>
                <div className="mb-4">
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="w-full rounded-lg"
                  />
                </div>
                <input
                  type="text"
                  value={quizState.answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="What do you see?"
                  className="w-full p-4 bg-slate-700/20 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}

            {currentQuestion.type === 'matching' && (
              <div className="space-y-3">
                {currentQuestion.options?.map((option, idx) => (
                  <div key={idx} className="flex gap-3">
                    <input
                      type="text"
                      value={quizState.answers[currentQuestion.id]?.[idx] || ''}
                      onChange={(e) => {
                        const newAnswers = quizState.answers[currentQuestion.id] || [];
                        newAnswers[idx] = e.target.value;
                        handleAnswer(newAnswers);
                      }}
                      placeholder={`Match: ${option}`}
                      className="flex-1 p-3 bg-slate-700/20 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Difficulty Badge */}
            <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                currentQuestion.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-300' :
                currentQuestion.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {currentQuestion.difficulty.toUpperCase()} Difficulty
              </div>
              <div className="text-sm text-slate-400">
                {isAnswered ? '✓ Answered' : 'Not answered'}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <button
              onClick={handlePrevious}
              disabled={quizState.currentQuestion === 0}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
            >
              Previous
            </button>
            
            {quizState.currentQuestion === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={!isAnswered || verifying}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {verifying ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Submit Quiz
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!isAnswered}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
              >
                Next Question
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Results Screen */
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
              quizState.score >= 70
                ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                : 'bg-gradient-to-br from-amber-500 to-orange-600'
            }`}>
              {quizState.score >= 70 ? (
                <CheckCircle className="w-12 h-12 text-white" />
              ) : (
                <XCircle className="w-12 h-12 text-white" />
              )}
            </div>
            
            <h1 className="text-4xl font-bold mb-2">
              {quizState.score >= 70 ? 'Quiz Passed! 🎉' : 'Try Again'}
            </h1>
            <p className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
              {Math.round(quizState.score)}%
            </p>
            <p className="text-slate-400">
              You got {Object.values(quizState.answers).length} out of {questions.length} correct
            </p>
          </div>

          {quizState.score >= 70 && (
            <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/10 border border-emerald-500/30 rounded-2xl p-8 mb-8 text-center">
              <Zap className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Badge Earned!</h2>
              <p className="text-slate-300 mb-4">You've earned a certificate of completion</p>
              <button className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors">
                View Certificate
              </button>
            </div>
          )}

          <button className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors">
            Return to Course
          </button>
        </div>
      )}
    </div>
  );
}

export default QuizPage;