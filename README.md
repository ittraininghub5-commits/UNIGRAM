# Unigram Academy API Documentation

This document outlines the available API endpoints for the Unigram Academy platform.

## Base URL
The base URL for all API endpoints is the root of the application (e.g., `http://localhost:3000` or your deployed URL).

---

## 1. Magic Link Authentication
Sends a secure magic link to the user's email for passwordless sign-in.

- **Endpoint:** `POST /api/send-magic-link`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response (Success):**
  ```json
  {
    "message": "Magic link sent successfully"
  }
  ```
- **Response (Error):**
  ```json
  {
    "error": "Error message details"
  }
  ```

---

## 2. Certificate Generation
Generates a PDF certificate of completion, uploads it to Supabase storage, and records it in the database.

- **Endpoint:** `POST /api/generate-certificate`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "enrollmentId": "uuid",
    "studentName": "John Doe",
    "courseTitle": "Web Development Mastery",
    "mentorName": "Dr. Priya Nair",
    "mentorId": "uuid",
    "studentId": "uuid",
    "courseId": "uuid"
  }
  ```
- **Response (Success):**
  ```json
  {
    "success": true,
    "certificateUrl": "https://supabase-url.com/storage/v1/object/public/certificates/...",
    "certificate": { ...certificateData }
  }
  ```
- **Response (Error):**
  ```json
  {
    "error": "Failed to generate certificate"
  }
  ```

---

## 3. AI Services (Gemini API)
The platform integrates Google's Gemini AI to provide several essential educational features. These are handled client-side using the `@google/generative-ai` SDK.

- **AI Chat Assistant:** A global floating chat interface for general educational queries.
- **AI Study Plan:** Generates personalized learning paths based on user goals and experience level.
- **AI Course Planner:** Helps mentors generate comprehensive course structures and outlines.
- **AI Knowledge Quiz:** Automatically generates quizzes based on course content to test student knowledge.
- **AI Video Insights:** Provides key takeaways and summaries from educational videos.
- **AI Course Recommendations:** Suggests relevant courses to users based on their interests.

---

## Environment Variables Required
To ensure these APIs and features function correctly, the following environment variables must be configured:

- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for storage/db access).
- `VITE_GEMINI_API_KEY`: Your Google Gemini API Key (Required for all AI features).
- `EMAIL_USER`: SMTP email address for Nodemailer.
- `EMAIL_PASS`: SMTP password for Nodemailer.
- `EMAIL_HOST`: SMTP host (e.g., `smtp.gmail.com`).
- `EMAIL_PORT`: SMTP port (e.g., `587`).
- `APP_URL`: The public URL of your application (used in magic link emails).

---

## Verification: Everything is Free
Unigram Academy is committed to open education. 
- **No Subscription Fees:** All courses are accessible without a paid subscription.
- **Free Certification:** Certificates of completion are generated and issued at no cost.
- **Open Mentorship:** Connecting with mentors and receiving recommendations is a free service.
- **Free AI Assistance:** All AI-powered features (Study Plans, Quizzes, Chat) are provided free of charge to all users.

