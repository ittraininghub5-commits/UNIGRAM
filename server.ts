import express, { Request } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { validateCertificateEligibility } from "./src/lib/certificateValidation";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const appUrl = process.env.APP_URL || "http://localhost:3000";
const emailUser = process.env.EMAIL_USER || "";
const emailPass = process.env.EMAIL_PASS || "";
const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
const emailPort = Number(process.env.EMAIL_PORT || 587);

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ Supabase environment variables are missing. Backend certificate generation will fail and fallback to client-side generation.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CertificatePayload {
  enrollmentId: string;
  studentName: string;
  courseTitle: string;
  mentorName: string;
  mentorId: string;
  studentId: string;
  courseId: string;
}

interface AuthContext {
  userId: string;
  role: string | null;
  email: string | null;
}

async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return null;
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  return {
    userId: userData.user.id,
    role: typeof profileData?.role === "string" ? profileData.role : null,
    email: userData.user.email || null,
  };
}

function hasMentorRole(role: string | null | undefined): boolean {
  return String(role || "").toLowerCase().startsWith("mentor");
}

async function createOrFetchCertificate(payload: CertificatePayload) {
  const { enrollmentId, studentName, courseTitle, mentorName, mentorId, studentId, courseId } = payload;

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, student_id, course_id, completed")
    .eq("id", enrollmentId)
    .single();

  if (enrollmentError || !enrollment) {
    throw new Error("Enrollment not found");
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, mentor_id, title")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    throw new Error("Course not found");
  }

  const eligibility = validateCertificateEligibility(
    { enrollmentId, studentId, courseId, mentorId },
    enrollment,
    course,
  );

  if (!eligibility.valid) {
    throw new Error(eligibility.reason || "Certificate is not eligible");
  }

  const { data: existingCert, error: existingCertError } = await supabase
    .from("certificates")
    .select("id, enrollment_id, student_id, mentor_id, course_id, issue_date, certificate_url")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (existingCertError) {
    throw existingCertError;
  }

  if (existingCert?.certificate_url) {
    return { certificateUrl: existingCert.certificate_url, certificate: existingCert };
  }

  const doc = new PDFDocument({
    layout: "landscape",
    size: "A4",
  });

  const chunks: any[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const width = doc.page.width;
  const height = doc.page.height;

  doc.rect(20, 20, width - 40, height - 40).stroke("#00D9A0");
  doc.rect(30, 30, width - 60, height - 60).stroke("#1A2340");

  doc.fillColor("#1A2340").fontSize(40).font("Helvetica-Bold").text("CERTIFICATE OF COMPLETION", 0, 100, { align: "center" });

  doc.fontSize(20).font("Helvetica").text("This is to certify that", 0, 180, { align: "center" });

  doc.fillColor("#00D9A0").fontSize(35).font("Helvetica-Bold").text(studentName, 0, 230, { align: "center" });

  doc.fillColor("#1A2340").fontSize(20).font("Helvetica").text("has successfully completed the course", 0, 300, { align: "center" });

  doc.fontSize(25).font("Helvetica-Bold").text(courseTitle, 0, 340, { align: "center" });

  doc.fontSize(15).font("Helvetica").text(`Issued on ${new Date().toLocaleDateString()}`, 0, 420, { align: "center" });

  doc.moveTo(100, 500).lineTo(300, 500).stroke();
  doc.fontSize(12).text(mentorName, 100, 510, { width: 200, align: "center" });
  doc.text("Course Mentor", 100, 525, { width: 200, align: "center" });

  doc.moveTo(width - 300, 500).lineTo(width - 100, 500).stroke();
  doc.fontSize(12).text("Unigram Academy", width - 300, 510, { width: 200, align: "center" });
  doc.text("Authorized Signatory", width - 300, 525, { width: 200, align: "center" });

  doc.end();

  const pdfBuffer = await pdfPromise;

  const fileName = `certificates/${enrollmentId}-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("certificates")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("certificates")
    .getPublicUrl(fileName);

  const { data: certData, error: dbError } = await supabase
    .from("certificates")
    .upsert({
      enrollment_id: enrollmentId,
      student_id: studentId,
      mentor_id: mentorId,
      course_id: courseId,
      certificate_url: publicUrl,
      issue_date: new Date().toISOString(),
    }, { onConflict: "enrollment_id" })
    .select()
    .single();

  if (dbError) throw dbError;

  return { certificateUrl: publicUrl, certificate: certData };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getMagicLinkTemplate(params: { recipientName: string; actionUrl: string; actionLabel: string }) {
  const safeName = escapeHtml(params.recipientName);
  const safeUrl = escapeHtml(params.actionUrl);
  const safeActionLabel = escapeHtml(params.actionLabel);

  const html = `
  <div style="background:#060b1a;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#dce3f0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:linear-gradient(160deg,#0b1228 0%,#111a34 100%);border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">
      <tr>
        <td style="padding:28px 28px 12px 28px;">
          <div style="font-size:28px;line-height:1.1;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Uni<span style="color:#00d9a0;">gram</span></div>
          <p style="margin:10px 0 0 0;color:#95a4c8;font-size:13px;">Professional learning platform</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0 28px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;font-weight:700;">Secure sign-in link</h1>
          <p style="margin:12px 0 0 0;color:#c8d2ea;font-size:15px;line-height:1.65;">Hi ${safeName}, use the button below to continue to your account. This link is secure and expires automatically.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:linear-gradient(90deg,#00d9a0,#00f5b4);color:#04111c;text-decoration:none;font-weight:800;border-radius:12px;font-size:14px;">${safeActionLabel}</a>
          <p style="margin:16px 0 0 0;color:#8ea2cc;font-size:12px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:</p>
          <p style="margin:8px 0 0 0;word-break:break-all;color:#9fd8c8;font-size:12px;">${safeUrl}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 24px 28px;">
          <div style="background:rgba(0,217,160,0.08);border:1px solid rgba(0,217,160,0.35);border-radius:12px;padding:12px 14px;color:#b9f4e3;font-size:12px;line-height:1.6;">
            If you did not request this email, you can safely ignore it.
          </div>
        </td>
      </tr>
    </table>
  </div>`;

  const text = `Unigram\n\nHi ${params.recipientName},\n\nUse this secure link to continue:\n${params.actionUrl}\n\nIf you did not request this email, you can ignore it.`;

  return { html, text };
}

const FALLBACK_INDIAN_COLLEGES = [
  "Indian Institute of Technology Bombay",
  "Indian Institute of Technology Delhi",
  "Indian Institute of Technology Madras",
  "Indian Institute of Technology Kanpur",
  "Indian Institute of Technology Kharagpur",
  "Indian Institute of Technology Roorkee",
  "Indian Institute of Science",
  "All India Institute of Medical Sciences",
  "Jawaharlal Nehru University",
  "University of Delhi",
  "Banaras Hindu University",
  "Anna University",
  "University of Mumbai",
  "Savitribai Phule Pune University",
  "Jadavpur University",
  "Vellore Institute of Technology",
  "SRM Institute of Science and Technology",
  "Birla Institute of Technology and Science Pilani",
  "National Institute of Technology Tiruchirappalli",
  "National Institute of Technology Surathkal",
  "National Institute of Technology Rourkela",
  "Amity University",
  "Manipal Academy of Higher Education",
  "Jamia Millia Islamia",
  "Aligarh Muslim University",
  "Calcutta University",
  "Osmania University",
  "Christ University",
  "Symbiosis International University",
  "Sardar Vallabhbhai National Institute of Technology",
  "Kaunya Institution of Technology and Sciences",
  "Karunya Institute of Technology and Sciences",
  "Karunya University",
];

let indianCollegesCache: string[] | null = null;
let indianCollegesLastFetch = 0;
const INDIAN_COLLEGES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchIndianCollegesFromRemote(): Promise<string[]> {
  const response = await fetch("https://universities.hipolabs.com/search?country=India");
  if (!response.ok) {
    throw new Error(`Remote colleges API failed: ${response.status}`);
  }

  const data = await response.json();
  const names = Array.isArray(data)
    ? data
        .map((item: any) => String(item?.name || "").trim())
        .filter(Boolean)
    : [];

  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

async function startServer() {
  const app = express();
  const initialPort = Number(process.env.PORT || 3000);
  const maxPortAttempts = 10;

  app.use(express.json());

  // API routes
  app.get("/api/indian-colleges", async (_req, res) => {
    const now = Date.now();
    if (indianCollegesCache && now - indianCollegesLastFetch < INDIAN_COLLEGES_CACHE_TTL_MS) {
      return res.json({ colleges: indianCollegesCache, source: "cache" });
    }

    try {
      const remote = await fetchIndianCollegesFromRemote();
      if (remote.length > 0) {
        indianCollegesCache = remote;
        indianCollegesLastFetch = now;
        return res.json({ colleges: remote, source: "remote" });
      }
    } catch (error) {
      console.warn("Indian colleges remote fetch failed, using fallback list.", error);
    }

    if (!indianCollegesCache || indianCollegesCache.length === 0) {
      indianCollegesCache = [...FALLBACK_INDIAN_COLLEGES].sort((a, b) => a.localeCompare(b));
      indianCollegesLastFetch = now;
    }

    return res.json({ colleges: indianCollegesCache, source: "fallback" });
  });

  app.post("/api/send-magic-link", async (req, res) => {
    const { email, fullName, type, intent, role, institution } = req.body as {
      email?: string;
      fullName?: string;
      type?: "magiclink" | "recovery";
      intent?: "login" | "register";
      role?: string;
      institution?: string | null;
    };
    const emailValue = String(email || "").trim().toLowerCase();

    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      return res.status(400).json({ error: "A valid email is required" });
    }

    if (!emailUser || !emailPass) {
      return res.status(500).json({ error: "Email service is not configured" });
    }

    try {
      const linkType = type === "recovery" ? "recovery" : "magiclink";
      const intentValue = intent === "register" ? "register" : "login";
      const normalizedRole = String(role || "student").toLowerCase().startsWith("mentor") ? "mentor" : "student";
      const normalizedInstitution = typeof institution === "string" ? institution.trim() || null : null;

      if (linkType === "magiclink" && intentValue === "register") {
        const { data: existingProfile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", emailValue)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!existingProfile) {
          const { error: createUserError } = await supabase.auth.admin.createUser({
            email: emailValue,
            email_confirm: true,
            user_metadata: {
              full_name: (fullName || emailValue.split("@")[0] || "Learner").trim(),
              role: normalizedRole,
              institution: normalizedRole === "mentor" ? normalizedInstitution : null,
            },
          });

          const createUserMessage = String(createUserError?.message || "").toLowerCase();
          if (createUserError && !createUserMessage.includes("already") && !createUserMessage.includes("registered")) {
            throw createUserError;
          }
        }
      }

      const redirectParams = new URLSearchParams({
        intent: intentValue,
        role: normalizedRole,
      });
      const redirectTo = `${appUrl}/auth/callback?${redirectParams.toString()}`;

      const { data, error } = await supabase.auth.admin.generateLink({
        type: linkType,
        email: emailValue,
        options: { redirectTo },
      });

      if (error) throw error;

      const actionLink = data?.properties?.action_link || (data as any)?.action_link;
      if (!actionLink) {
        throw new Error("Unable to generate authentication link");
      }

      const transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      const recipientName = (fullName || emailValue.split("@")[0] || "Learner").trim();
      const actionLabel = linkType === "recovery" ? "Reset Password" : "Continue To Unigram";
      const { html, text } = getMagicLinkTemplate({ recipientName, actionUrl: actionLink, actionLabel });

      await transporter.sendMail({
        from: `Unigram Academy <${emailUser}>`,
        to: emailValue,
        subject: linkType === "recovery" ? "Reset your Unigram password" : "Your Unigram magic sign-in link",
        html,
        text,
      });

      return res.json({ success: true, message: "Magic link sent" });
    } catch (error: any) {
      console.error("Magic link email error:", error);
      return res.status(500).json({ error: error.message || "Failed to send magic link" });
    }
  });

  app.post("/api/generate-certificate", async (req, res) => {
    const { enrollmentId, studentName, courseTitle, mentorName, mentorId, studentId, courseId } = req.body;

    if (!enrollmentId || !studentName || !courseTitle || !mentorName || !mentorId || !studentId || !courseId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const auth = await getAuthContext(req);
      if (!auth) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (auth.userId !== studentId && auth.userId !== mentorId) {
        return res.status(403).json({ error: "You are not allowed to generate this certificate" });
      }

      if (auth.userId === mentorId && !hasMentorRole(auth.role)) {
        return res.status(403).json({ error: "Only mentors can generate certificates for students" });
      }

      const certData = await createOrFetchCertificate({
        enrollmentId,
        studentName,
        courseTitle,
        mentorName,
        mentorId,
        studentId,
        courseId,
      });

      res.json({ success: true, certificateUrl: certData.certificateUrl, certificate: certData.certificate });
    } catch (error: any) {
      console.error("Certificate generation error:", error);
      const message = error.message || "Failed to generate certificate";
      const statusCode = message === "Course is not completed yet" ? 409 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  app.post("/api/certificate-requests/:id/approve", async (req, res) => {
    const requestId = req.params.id;
    const { mentorNotes } = req.body as { mentorNotes?: string };

    const auth = await getAuthContext(req);
    if (!auth) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!hasMentorRole(auth.role)) {
      return res.status(403).json({ error: "Mentor access required" });
    }

    if (!requestId) {
      return res.status(400).json({ error: "Request ID is required" });
    }

    try {
      const { data: certRequest, error: certRequestError } = await supabase
        .from("certificate_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (certRequestError || !certRequest) {
        return res.status(404).json({ error: "Certificate request not found" });
      }

      if (certRequest.mentor_id !== auth.userId) {
        return res.status(403).json({ error: "You are not allowed to approve this request" });
      }

      if (certRequest.status === "approved") {
        const { data: existingCertificate } = await supabase
          .from("certificates")
          .select("*")
          .eq("enrollment_id", certRequest.enrollment_id)
          .maybeSingle();

        return res.json({
          success: true,
          certificate: existingCertificate || null,
          request: certRequest,
        });
      }

      const { data: student, error: studentError } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", certRequest.student_id)
        .single();

      if (studentError || !student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("title")
        .eq("id", certRequest.course_id)
        .single();

      if (courseError || !course) {
        return res.status(404).json({ error: "Course not found" });
      }

      const { data: mentor, error: mentorError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", certRequest.mentor_id)
        .single();

      if (mentorError || !mentor) {
        return res.status(404).json({ error: "Mentor profile not found" });
      }

      const certGenerationData = await createOrFetchCertificate({
        enrollmentId: certRequest.enrollment_id,
        studentName: student.full_name || student.email,
        courseTitle: course.title,
        mentorName: mentor.full_name || "Unigram Mentor",
        mentorId: certRequest.mentor_id,
        studentId: certRequest.student_id,
        courseId: certRequest.course_id,
      });

      const { data: updatedRequest, error: updateError } = await supabase
        .from("certificate_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          mentor_notes: mentorNotes || null,
        })
        .eq("id", requestId)
        .select("*")
        .single();

      if (updateError) throw updateError;

      return res.json({
        success: true,
        certificate: certGenerationData.certificate,
        request: updatedRequest,
      });
    } catch (error: any) {
      console.error("Certificate approval error:", error);
      return res.status(500).json({ error: error.message || "Failed to approve certificate" });
    }
  });

  app.post("/api/certificate-requests/:id/reject", async (req, res) => {
    const requestId = req.params.id;
    const { mentorNotes } = req.body as { mentorNotes?: string };

    const auth = await getAuthContext(req);
    if (!auth) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!hasMentorRole(auth.role)) {
      return res.status(403).json({ error: "Mentor access required" });
    }

    if (!requestId) {
      return res.status(400).json({ error: "Request ID is required" });
    }

    try {
      const { data: certRequest, error: certRequestError } = await supabase
        .from("certificate_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (certRequestError || !certRequest) {
        return res.status(404).json({ error: "Certificate request not found" });
      }

      if (certRequest.mentor_id !== auth.userId) {
        return res.status(403).json({ error: "You are not allowed to reject this request" });
      }

      if (certRequest.status === "approved") {
        return res.status(409).json({ error: "Approved requests cannot be rejected" });
      }

      if (certRequest.status === "rejected") {
        return res.json({
          success: true,
          request: certRequest,
        });
      }

      const { data: updatedRequest, error: updateError } = await supabase
        .from("certificate_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          mentor_notes: mentorNotes || null,
        })
        .eq("id", requestId)
        .select("*")
        .single();

      if (updateError) throw updateError;

      return res.json({
        success: true,
        request: updatedRequest,
      });
    } catch (error: any) {
      console.error("Certificate rejection error:", error);
      return res.status(500).json({ error: error.message || "Failed to reject certificate request" });
    }
  });

  app.post('/api/profile/ensure-role', async (req, res) => {
    const auth = await getAuthContext(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { role, institution, fullName, intent } = req.body as {
      role?: string;
      institution?: string | null;
      fullName?: string;
      intent?: 'register' | 'login';
    };

    const normalizedRole = String(role || 'student').toLowerCase().startsWith('mentor') ? 'mentor' : 'student';
    const normalizedInstitution = typeof institution === 'string' ? institution.trim() || null : null;
    const normalizedName = String(fullName || '').trim() || null;

    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, institution, full_name')
        .eq('id', auth.userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!existingProfile) {
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: auth.userId,
            email: auth.email || '',
            full_name: normalizedName || (auth.email?.split('@')[0] || 'User'),
            role: normalizedRole,
            institution: normalizedRole === 'mentor' ? normalizedInstitution : null,
          })
          .select('id, role, institution')
          .single();

        if (insertError) throw insertError;
        return res.json({ success: true, profile: inserted });
      }

      const currentRole = String(existingProfile.role || 'student').toLowerCase().startsWith('mentor') ? 'mentor' : 'student';
      if (currentRole === 'mentor' && normalizedRole === 'student') {
        return res.status(403).json({ error: 'Mentor role cannot be downgraded from this flow' });
      }

      const shouldUpgradeRole = intent === 'register' && currentRole === 'student' && normalizedRole === 'mentor';
      const nextRole = shouldUpgradeRole ? 'mentor' : currentRole;

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({
          role: nextRole,
          institution: nextRole === 'mentor' ? (normalizedInstitution || existingProfile.institution) : existingProfile.institution,
          full_name: normalizedName || existingProfile.full_name,
        })
        .eq('id', auth.userId)
        .select('id, role, institution')
        .single();

      if (updateError) throw updateError;

      return res.json({ success: true, profile: updated });
    } catch (error: any) {
      console.error('Ensure role error:', error);
      return res.status(500).json({ error: error.message || 'Failed to ensure profile role' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const listenOnAvailablePort = (port: number, attempt: number = 0) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });

    server.on("error", (error: any) => {
      if (error?.code === "EADDRINUSE" && attempt < maxPortAttempts) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is busy, retrying on ${nextPort}...`);
        listenOnAvailablePort(nextPort, attempt + 1);
        return;
      }

      console.error("Server failed to start:", error);
      process.exit(1);
    });
  };

  listenOnAvailablePort(initialPort);
}

startServer();
