import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ Supabase environment variables are missing. Backend certificate generation will fail and fallback to client-side generation.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/generate-certificate", async (req, res) => {
    const { enrollmentId, studentName, courseTitle, mentorName, mentorId, studentId, courseId } = req.body;

    if (!enrollmentId || !studentName || !courseTitle || !mentorName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // 1. Generate PDF
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

      // Certificate Design
      const width = doc.page.width;
      const height = doc.page.height;

      // Border
      doc.rect(20, 20, width - 40, height - 40).stroke("#00D9A0");
      doc.rect(30, 30, width - 60, height - 60).stroke("#1A2340");

      // Content
      doc.fillColor("#1A2340").fontSize(40).font("Helvetica-Bold").text("CERTIFICATE OF COMPLETION", 0, 100, { align: "center" });
      
      doc.fontSize(20).font("Helvetica").text("This is to certify that", 0, 180, { align: "center" });
      
      doc.fillColor("#00D9A0").fontSize(35).font("Helvetica-Bold").text(studentName, 0, 230, { align: "center" });
      
      doc.fillColor("#1A2340").fontSize(20).font("Helvetica").text("has successfully completed the course", 0, 300, { align: "center" });
      
      doc.fontSize(25).font("Helvetica-Bold").text(courseTitle, 0, 340, { align: "center" });
      
      doc.fontSize(15).font("Helvetica").text(`Issued on ${new Date().toLocaleDateString()}`, 0, 420, { align: "center" });

      // Signatures
      doc.moveTo(100, 500).lineTo(300, 500).stroke();
      doc.fontSize(12).text(mentorName, 100, 510, { width: 200, align: "center" });
      doc.text("Course Mentor", 100, 525, { width: 200, align: "center" });

      doc.moveTo(width - 300, 500).lineTo(width - 100, 500).stroke();
      doc.fontSize(12).text("Unigram Academy", width - 300, 510, { width: 200, align: "center" });
      doc.text("Authorized Signatory", width - 300, 525, { width: 200, align: "center" });

      doc.end();

      const pdfBuffer = await pdfPromise;

      // 2. Upload to Supabase Storage
      const fileName = `certificates/${enrollmentId}-${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("certificates")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("certificates")
        .getPublicUrl(fileName);

      // 4. Store in Database
      const { data: certData, error: dbError } = await supabase
        .from("certificates")
        .upsert({
          enrollment_id: enrollmentId,
          student_id: studentId,
          mentor_id: mentorId,
          course_id: courseId,
          certificate_url: publicUrl,
          issue_date: new Date().toISOString(),
        }, { onConflict: 'enrollment_id' })
        .select()
        .single();

      if (dbError) throw dbError;

      res.json({ success: true, certificateUrl: publicUrl, certificate: certData });
    } catch (error: any) {
      console.error("Certificate generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate certificate" });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
