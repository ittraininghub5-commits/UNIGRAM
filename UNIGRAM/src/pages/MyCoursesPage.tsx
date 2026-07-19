import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, BookOpen, Clock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '@/src/context/ThemeContext';

interface Course {
  id: string;
  title: string;
  mentor: {
    full_name: string;
    avatar_url?: string;
  };
  progress: number;
  status: 'completed' | 'in-progress' | 'pending';
  dueDate?: string;
  materials_count: number;
}

export function MyCoursesPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'in-progress' | 'pending'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Fetch enrolled courses with mentor and progress info
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          progress_pct,
          completed,
          courses (
            id,
            title,
            modules_count,
            profiles:mentor_id (full_name, avatar_url)
          )
        `)
        .eq('student_id', user.id);

      if (error) throw error;

      // Map to Course interface
      const coursesData: Course[] = data?.map((enrollment: any) => ({
        id: enrollment.courses.id,
        title: enrollment.courses.title,
        mentor: enrollment.courses.profiles,
        progress: enrollment.progress_pct || 0,
        status: enrollment.completed ? 'completed' : enrollment.progress_pct > 0 ? 'pending' : 'in-progress',
        materials_count: enrollment.courses.modules_count || 0
      })) || [];

      setCourses(coursesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setLoading(false);
    }
  };

  const filteredCourses = filter === 'all' 
    ? courses 
    : courses.filter(course => course.status === filter);

  const stats = {
    completed: courses.filter(c => c.status === 'completed').length,
    inProgress: courses.filter(c => c.status === 'in-progress').length,
    pending: courses.filter(c => c.status === 'pending').length
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 py-8 pt-24 text-text-primary relative">
        <div className="pointer-events-none absolute -top-8 right-6 w-56 h-56 rounded-full bg-[radial-gradient(circle,rgba(201,35,248,0.12),transparent_70%)]" />
        {/* Back Button */}
        <button
          onClick={() => navigate('/feed')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header - Centered */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            My Courses
          </h1>
          <p className="text-lg text-text-secondary">
            Track your learning journey across all instructors
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="border rounded-2xl p-6 transition-colors bg-bg-card/70 border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-accent-teal">COMPLETED</p>
                <p className="text-3xl font-bold mt-2 text-text-primary">{stats.completed}</p>
              </div>
              <CheckCircle className="w-12 h-12 opacity-25 text-accent-teal" />
            </div>
          </div>
          
          <div className="border rounded-2xl p-6 transition-colors bg-bg-card/70 border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-accent-amber">IN PROGRESS</p>
                <p className="text-3xl font-bold mt-2 text-text-primary">{stats.inProgress}</p>
              </div>
              <Clock className="w-12 h-12 opacity-25 text-accent-amber" />
            </div>
          </div>
          
          <div className="border rounded-2xl p-6 transition-colors bg-bg-card/70 border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-accent-amber">PENDING</p>
                <p className="text-3xl font-bold mt-2 text-text-primary">{stats.pending}</p>
              </div>
              <AlertCircle className="w-12 h-12 opacity-25 text-accent-amber" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {(['all', 'completed', 'in-progress', 'pending'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-6 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                filter === tab
                  ? 'bg-accent-amber text-bg-base'
                  : 'bg-bg-elevated/60 text-text-secondary border border-white/10 hover:border-white/25'
              }`}
            >
              {tab === 'all' ? 'All Courses' : tab === 'in-progress' ? 'In Progress' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Courses Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-accent-amber border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading your courses...</p>
            </div>
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="group relative border rounded-2xl p-6 overflow-hidden transition-all duration-300 bg-bg-card/70 border-white/10 hover:border-accent-amber/60"
              >
                {/* Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-teal via-accent-amber to-accent-purple opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10">
                  {/* Course Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1 text-text-primary">{course.title}</h3>
                      <p className="text-sm text-text-secondary">By {course.mentor.full_name}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      course.status === 'completed' ? 'bg-accent-teal/20 text-accent-teal' :
                      course.status === 'in-progress' ? 'bg-accent-amber/20 text-accent-amber' :
                      'bg-accent-amber/20 text-accent-amber'
                    }`}>
                      {course.status === 'completed' ? '✓ Complete' : course.status === 'in-progress' ? 'In Progress' : 'Pending'}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-text-secondary">Progress</span>
                      <span className="text-sm font-semibold text-accent-amber">{course.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden bg-bg-elevated">
                      <div
                        className="h-full bg-gradient-to-r from-accent-teal via-accent-amber to-accent-purple transition-all duration-500"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Course Info */}
                  <div className="flex items-center gap-4 text-sm mb-6 text-text-secondary">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{course.materials_count} materials</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => navigate(`/course/${course.id}`)}
                    className="w-full bg-accent-amber hover:brightness-110 text-bg-base font-semibold py-2 rounded-full flex items-center justify-center gap-2 transition-all group/btn"
                  >
                    {course.status === 'completed' ? 'Request / Track Certificate' : 'Continue Learning'}
                    <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-text-secondary">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50 text-text-muted" />
            <p className="mb-4">No courses found in this category</p>
            <button
              onClick={() => navigate('/search')}
              className="px-6 py-2 bg-accent-amber hover:brightness-110 text-bg-base rounded-lg font-semibold transition-colors"
            >
              Explore Courses
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyCoursesPage;
