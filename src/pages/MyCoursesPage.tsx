import React, { useState, useEffect } from 'react';
import { ChevronRight, BookOpen, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
        status: enrollment.completed ? 'completed' : enrollment.progress_pct > 0 ? 'in-progress' : 'pending',
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6 md:p-8">
      {/* Header */}
      <div className="mb-12">
<h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent">          My Courses
        </h1>
        <p className="text-slate-400">Track your learning journey across all instructors</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-400 text-sm font-semibold">COMPLETED</p>
              <p className="text-3xl font-bold mt-2">{stats.completed}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-emerald-400 opacity-20" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-semibold">IN PROGRESS</p>
              <p className="text-3xl font-bold mt-2">{stats.inProgress}</p>
            </div>
            <Clock className="w-12 h-12 text-blue-400 opacity-20" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-400 text-sm font-semibold">PENDING</p>
              <p className="text-3xl font-bold mt-2">{stats.pending}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-amber-400 opacity-20" />
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
  ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
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
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading your courses...</p>
          </div>
        </div>
      ) : filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl p-6 overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              {/* Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10">
                {/* Course Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">{course.title}</h3>
                    <p className="text-sm text-slate-400">By {course.mentor.full_name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    course.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    course.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>
                    {course.status === 'completed' ? '✓ Complete' : course.status === 'in-progress' ? 'In Progress' : 'Pending'}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400">Progress</span>
                    <span className="text-sm font-semibold text-cyan-400">{course.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>

                {/* Course Info */}
                <div className="flex items-center gap-4 text-sm text-slate-400 mb-6">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    <span>{course.materials_count} materials</span>
                  </div>
                </div>

                {/* Action Button */}
                <button className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-all group/btn">
                  {course.status === 'completed' ? 'View Certificate' : 'Continue Learning'}
                  <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-50" />
          <p className="text-slate-400 mb-4">No courses found in this category</p>
          <button className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold transition-colors">
            Explore Courses
          </button>
        </div>
      )}
    </div>
  );
}

export default MyCoursesPage;