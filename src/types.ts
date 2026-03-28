export type UserRole = 'student' | 'mentor';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  role: UserRole;
  bio: string | null;
  avatar_url: string | null;
  institution: string | null;
  phone: string | null;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  created_at: string;
}

export interface Course {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  thumbnail_url: string | null;
  status: 'draft' | 'live' | 'archived';
  modules_count: number;
  videos_count: number;
  ai_processed: boolean;
  created_at: string;
  updated_at: string;
  mentor?: Profile;
}

export interface CourseMaterial {
  id: string;
  course_id: string;
  mentor_id: string;
  type: 'pdf' | 'ppt' | 'notebook' | 'youtube' | 'video';
  title: string | null;
  file_url: string | null;
  youtube_url: string | null;
  description: string | null;
  summary: string | null;
  ai_tags: string[] | null;
  order_index: number;
  duration_sec: number | null;
  processed: boolean;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  ai_generated: boolean;
  created_at: string;
}

export interface Quiz {
  id: string;
  course_id: string;
  material_id: string | null;
  title: string;
  created_at: string;
  questions?: QuizQuestion[];
}

export interface Recommendation {
  id: string;
  mentor_id: string;
  student_id: string;
  content: string;
  created_at: string;
  mentor?: Profile;
  student?: Profile;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  student_id: string;
  mentor_id: string;
  course_id: string;
  issue_date: string;
  certificate_url: string | null;
  course?: Course;
  mentor?: Profile;
}

export interface Submission {
  id: string;
  enrollment_id: string;
  material_id: string;
  student_id: string;
  content_url: string;
  feedback: string | null;
  grade: string | null;
  status: 'pending' | 'reviewed';
  created_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  progress_pct: number;
  completed: boolean;
  enrolled_at: string;
  course?: Course;
}

export interface CourseProgress {
  id: string;
  enrollment_id: string;
  material_id: string;
  completed: boolean;
  completed_at: string | null;
}

export interface Video {
  id: string;
  mentor_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  mentor?: Profile;
  course?: Course;
}

export interface Message {
  id: string;
  from_id: string;
  to_id: string;
  content: string | null;
  read: boolean;
  created_at: string;
  from?: Profile;
  to?: Profile;
}

export interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  user?: Profile;
}
