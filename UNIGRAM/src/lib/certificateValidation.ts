export interface EnrollmentRecord {
  id: string;
  student_id: string;
  course_id: string;
  completed: boolean;
}

export interface CourseRecord {
  id: string;
  mentor_id: string;
}

export interface CertificateRequestData {
  enrollmentId: string;
  studentId: string;
  courseId: string;
  mentorId: string;
}

export function validateCertificateEligibility(
  request: CertificateRequestData,
  enrollment: EnrollmentRecord,
  course: CourseRecord,
): { valid: boolean; reason?: string } {
  if (enrollment.id !== request.enrollmentId) {
    return { valid: false, reason: 'Enrollment ID mismatch' };
  }

  if (enrollment.student_id !== request.studentId || enrollment.course_id !== request.courseId) {
    return { valid: false, reason: 'Enrollment does not match student/course' };
  }

  if (!enrollment.completed) {
    return { valid: false, reason: 'Course is not completed yet' };
  }

  if (course.id !== request.courseId || course.mentor_id !== request.mentorId) {
    return { valid: false, reason: 'Mentor does not own this course' };
  }

  return { valid: true };
}
