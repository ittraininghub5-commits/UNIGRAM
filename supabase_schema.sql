-- Unigram Database Schema (Supabase/PostgreSQL)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables to ensure a clean state (Optional - uncomment if needed)
-- DROP TABLE IF EXISTS comments CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS submissions CASCADE;
-- DROP TABLE IF EXISTS certificates CASCADE;
-- DROP TABLE IF EXISTS recommendations CASCADE;
-- DROP TABLE IF EXISTS quiz_questions CASCADE;
-- DROP TABLE IF EXISTS quizzes CASCADE;
-- DROP TABLE IF EXISTS ai_insights CASCADE;
-- DROP TABLE IF EXISTS follows CASCADE;
-- DROP TABLE IF EXISTS course_progress CASCADE;
-- DROP TABLE IF EXISTS enrollments CASCADE;
-- DROP TABLE IF EXISTS course_materials CASCADE;
-- DROP TABLE IF EXISTS videos CASCADE;
-- DROP TABLE IF EXISTS courses CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  role TEXT CHECK (role IN ('student', 'mentor')) NOT NULL DEFAULT 'student',
  institution TEXT,
  bio TEXT,
  avatar_url TEXT,
  phone TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[], -- Array of strings
  thumbnail_url TEXT,
  status TEXT CHECK (status IN ('draft', 'live', 'archived')) DEFAULT 'draft',
  modules_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  ai_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_sec INTEGER,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Course Materials Table
CREATE TABLE IF NOT EXISTS course_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  mentor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('pdf', 'ppt', 'notebook', 'youtube', 'video')) NOT NULL,
  title TEXT,
  file_url TEXT,
  youtube_url TEXT,
  description TEXT,
  summary TEXT,
  ai_tags TEXT[],
  order_index INTEGER DEFAULT 0,
  duration_sec INTEGER,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  progress_pct INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, course_id)
);

-- 6. Course Progress Table
CREATE TABLE IF NOT EXISTS course_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES course_materials(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(enrollment_id, material_id)
);

-- 7. Follows Table
CREATE TABLE IF NOT EXISTS follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(follower_id, following_id)
);

-- 8. AI Insights Table
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  key_takeaways TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES course_materials(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 10. Quiz Questions Table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of strings
  correct_answer INTEGER NOT NULL, -- Index of correct option
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. Recommendations Table
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 12. Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mentor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  certificate_url TEXT,
  UNIQUE(enrollment_id)
);

-- 12b. Certificate Requests Table
CREATE TABLE IF NOT EXISTS certificate_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mentor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  mentor_notes TEXT,
  UNIQUE(enrollment_id)
);

-- 13. Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES course_materials(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_url TEXT NOT NULL,
  feedback TEXT,
  grade TEXT,
  status TEXT CHECK (status IN ('pending', 'reviewed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 14. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  "read" BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 15. Comments Table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 16. Blocked Users Table
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(blocker_id, blocked_id)
);

-- 17. Game Scores Table
CREATE TABLE IF NOT EXISTS game_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  game_type TEXT CHECK (game_type IN ('reaction', 'typing', 'memory', 'hunter')) NOT NULL,
  score INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_scores_type_score ON game_scores (game_type, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_created_at ON game_scores (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON blocked_users(blocked_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- Policies

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Courses
CREATE POLICY "Live courses are viewable by everyone" ON courses FOR SELECT USING (status = 'live');
CREATE POLICY "Mentors can manage own courses" ON courses FOR ALL USING (auth.uid() = mentor_id);

-- Videos
CREATE POLICY "Videos are viewable by everyone" ON videos FOR SELECT USING (true);
CREATE POLICY "Mentors can manage own videos" ON videos FOR ALL USING (auth.uid() = mentor_id);

-- Course Materials
CREATE POLICY "Course materials viewable by everyone" ON course_materials FOR SELECT USING (true);
CREATE POLICY "Mentors can manage course materials" ON course_materials FOR ALL USING (auth.uid() = mentor_id);

-- Enrollments
CREATE POLICY "Enrollments viewable by student or mentor" ON enrollments FOR SELECT USING (
  auth.uid() = student_id OR 
  EXISTS (SELECT 1 FROM courses WHERE id = course_id AND mentor_id = auth.uid())
);
CREATE POLICY "Students can enroll themselves" ON enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Course Progress
CREATE POLICY "Course progress viewable by student or mentor" ON course_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE id = enrollment_id AND student_id = auth.uid()) OR 
  EXISTS (SELECT 1 FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.id = enrollment_id AND c.mentor_id = auth.uid())
);
CREATE POLICY "Students can update own progress" ON course_progress FOR ALL USING (
  EXISTS (SELECT 1 FROM enrollments WHERE id = enrollment_id AND student_id = auth.uid())
);

-- Follows
CREATE POLICY "Follows viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON follows FOR ALL USING (auth.uid() = follower_id);

-- AI Insights
CREATE POLICY "AI insights viewable by everyone" ON ai_insights FOR SELECT USING (true);
CREATE POLICY "Mentors can manage AI insights" ON ai_insights FOR ALL USING (
  EXISTS (SELECT 1 FROM videos WHERE id = video_id AND mentor_id = auth.uid())
);

-- Quizzes
CREATE POLICY "Quizzes viewable by everyone" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Mentors can manage quizzes" ON quizzes FOR ALL USING (
  EXISTS (SELECT 1 FROM courses WHERE id = course_id AND mentor_id = auth.uid())
);

-- Quiz Questions
CREATE POLICY "Quiz questions viewable by everyone" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "Mentors can manage quiz questions" ON quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = quiz_id AND c.mentor_id = auth.uid())
);

-- Recommendations
CREATE POLICY "Recommendations viewable by everyone" ON recommendations FOR SELECT USING (true);
CREATE POLICY "Mentors can create recommendations" ON recommendations FOR INSERT WITH CHECK (auth.uid() = mentor_id);

-- Certificates
CREATE POLICY "Certificates viewable by everyone" ON certificates FOR SELECT USING (true);
CREATE POLICY "Mentors can issue certificates" ON certificates FOR INSERT WITH CHECK (auth.uid() = mentor_id);

-- Certificate Requests
CREATE POLICY "Certificate requests viewable by student or mentor" ON certificate_requests FOR SELECT USING (
  auth.uid() = student_id OR auth.uid() = mentor_id
);
CREATE POLICY "Students can request own certificate" ON certificate_requests FOR INSERT WITH CHECK (
  auth.uid() = student_id
);
CREATE POLICY "Mentors can review own certificate requests" ON certificate_requests FOR UPDATE USING (
  auth.uid() = mentor_id
) WITH CHECK (
  auth.uid() = mentor_id
);

-- Submissions
CREATE POLICY "Submissions viewable by student or mentor" ON submissions FOR SELECT USING (
  auth.uid() = student_id OR 
  EXISTS (SELECT 1 FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.id = enrollment_id AND c.mentor_id = auth.uid())
);
CREATE POLICY "Students can create submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Messages
CREATE POLICY "Messages viewable by sender or receiver" ON messages FOR SELECT USING (auth.uid() = from_id OR auth.uid() = to_id);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (
  auth.uid() = from_id AND
  NOT EXISTS (
    SELECT 1 FROM blocked_users WHERE blocker_id = from_id AND blocked_id = to_id
  ) AND
  NOT EXISTS (
    SELECT 1 FROM blocked_users WHERE blocker_id = to_id AND blocked_id = from_id
  )
);
CREATE POLICY "Recipients can mark messages as read" ON messages FOR UPDATE USING (auth.uid() = to_id) WITH CHECK (auth.uid() = to_id);
CREATE POLICY "Users can delete own messages" ON messages FOR DELETE USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Comments
CREATE POLICY "Comments viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can manage own comments" ON comments FOR ALL USING (auth.uid() = user_id);

-- Blocked Users
CREATE POLICY "Users can view their own blocked list" ON blocked_users FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "Users can block other users" ON blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock other users" ON blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- Game Scores
CREATE POLICY "Game scores viewable by everyone" ON game_scores FOR SELECT USING (true);
CREATE POLICY "Users can insert own game scores" ON game_scores FOR INSERT WITH CHECK (
  auth.uid() = player_id OR player_id IS NULL
);

-- Mentor role hardening policies
DROP POLICY IF EXISTS "Mentors can manage own courses" ON courses;
CREATE POLICY "Mentors can manage own courses" ON courses FOR ALL USING (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
) WITH CHECK (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

DROP POLICY IF EXISTS "Mentors can manage own videos" ON videos;
CREATE POLICY "Mentors can manage own videos" ON videos FOR ALL USING (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
) WITH CHECK (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

DROP POLICY IF EXISTS "Mentors can manage course materials" ON course_materials;
CREATE POLICY "Mentors can manage course materials" ON course_materials FOR ALL USING (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
) WITH CHECK (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

DROP POLICY IF EXISTS "Mentors can manage AI insights" ON ai_insights;
CREATE POLICY "Mentors can manage AI insights" ON ai_insights FOR ALL USING (
  EXISTS (
    SELECT 1 FROM videos v
    WHERE v.id = video_id
      AND v.mentor_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM videos v
    WHERE v.id = video_id
      AND v.mentor_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

DROP POLICY IF EXISTS "Mentors can manage quizzes" ON quizzes;
CREATE POLICY "Mentors can manage quizzes" ON quizzes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = course_id
      AND c.mentor_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = course_id
      AND c.mentor_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

DROP POLICY IF EXISTS "Mentors can manage quiz questions" ON quiz_questions;
CREATE POLICY "Mentors can manage quiz questions" ON quiz_questions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN courses c ON q.course_id = c.id
    WHERE q.id = quiz_id
      AND c.mentor_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN courses c ON q.course_id = c.id
    WHERE q.id = quiz_id
      AND c.mentor_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

DROP POLICY IF EXISTS "Mentors can issue certificates" ON certificates;
CREATE POLICY "Mentors can issue certificates" ON certificates FOR INSERT WITH CHECK (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

DROP POLICY IF EXISTS "Mentors can review own certificate requests" ON certificate_requests;
CREATE POLICY "Mentors can review own certificate requests" ON certificate_requests FOR UPDATE USING (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
) WITH CHECK (
  auth.uid() = mentor_id
  AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'mentor'
  )
);

-- Trigger for new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  normalized_role TEXT;
BEGIN
  normalized_role := CASE
    WHEN LOWER(COALESCE(new.raw_user_meta_data->>'role', 'student')) LIKE 'mentor%' THEN 'mentor'
    ELSE 'student'
  END;

  INSERT INTO public.profiles (id, full_name, email, role, institution)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'User'), 
    COALESCE(new.email, ''), 
    normalized_role,
    NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'institution', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = normalized_role,
    institution = COALESCE(EXCLUDED.institution, public.profiles.institution);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent users from self-changing role; allow only service role updates.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Role can only be changed by admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_profile_role_change();

-- 16. Triggers for Counts

-- Function to update followers/following counts
CREATE OR REPLACE FUNCTION public.handle_follow_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_change ON public.follows;
CREATE TRIGGER on_follow_change
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE PROCEDURE public.handle_follow_change();

-- Function to update video likes count
-- (Assuming a 'likes' table exists or will be added, but for now we can use a generic function if needed)
-- For now, let's just ensure the comments count works as we have a comments table.

CREATE OR REPLACE FUNCTION public.handle_comment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.videos SET comments_count = comments_count + 1 WHERE id = NEW.video_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.videos SET comments_count = comments_count - 1 WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_change ON public.comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_comment_change();

-- Function to update course modules/videos count
CREATE OR REPLACE FUNCTION public.handle_course_content_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (TG_TABLE_NAME = 'videos') THEN
      UPDATE public.courses SET videos_count = videos_count + 1 WHERE id = NEW.course_id;
    ELSIF (TG_TABLE_NAME = 'course_materials') THEN
      UPDATE public.courses SET modules_count = modules_count + 1 WHERE id = NEW.course_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF (TG_TABLE_NAME = 'videos') THEN
      UPDATE public.courses SET videos_count = videos_count - 1 WHERE id = OLD.course_id;
    ELSIF (TG_TABLE_NAME = 'course_materials') THEN
      UPDATE public.courses SET modules_count = modules_count - 1 WHERE id = OLD.course_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_video_change ON public.videos;
CREATE TRIGGER on_video_change
  AFTER INSERT OR DELETE ON public.videos
  FOR EACH ROW EXECUTE PROCEDURE public.handle_course_content_change();

DROP TRIGGER IF EXISTS on_material_change ON public.course_materials;
CREATE TRIGGER on_material_change
  AFTER INSERT OR DELETE ON public.course_materials
  FOR EACH ROW EXECUTE PROCEDURE public.handle_course_content_change();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_mentor_id ON courses(mentor_id);
CREATE INDEX IF NOT EXISTS idx_videos_mentor_id ON videos(mentor_id);
CREATE INDEX IF NOT EXISTS idx_videos_course_id ON videos(course_id);
CREATE INDEX IF NOT EXISTS idx_course_materials_course_id ON course_materials(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_enrollment_id ON course_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_enrollment_id ON submissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_id ON messages(from_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_id ON messages(to_id);
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);

-- 17. Storage for real course uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-content', 'course-content', true)
ON CONFLICT (id) DO NOTHING;

-- storage.objects RLS is managed by Supabase; do not ALTER here to avoid ownership errors.

DROP POLICY IF EXISTS "Public can read course content" ON storage.objects;
CREATE POLICY "Public can read course content"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-content');

DROP POLICY IF EXISTS "Mentors can upload own course content" ON storage.objects;
CREATE POLICY "Mentors can upload own course content"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-content'
  AND EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.mentor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Mentors can update own course content" ON storage.objects;
CREATE POLICY "Mentors can update own course content"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-content'
  AND EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.mentor_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'course-content'
  AND EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.mentor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Mentors can delete own course content" ON storage.objects;
CREATE POLICY "Mentors can delete own course content"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-content'
  AND EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.mentor_id = auth.uid()
  )
);