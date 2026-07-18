import { describe, it, expect } from 'vitest';
import { validateCertificateEligibility } from '../../src/lib/certificateValidation';

describe('validateCertificateEligibility', () => {
  const baseRequest = {
    enrollmentId: 'enr-1',
    studentId: 'student-1',
    courseId: 'course-1',
    mentorId: 'mentor-1',
  };

  const enrollment = {
    id: 'enr-1',
    student_id: 'student-1',
    course_id: 'course-1',
    completed: true,
  };

  const course = {
    id: 'course-1',
    mentor_id: 'mentor-1',
  };

  it('returns valid when enrollment matches and completed', () => {
    const res = validateCertificateEligibility(baseRequest, enrollment, course);
    expect(res.valid).toBe(true);
  });

  it('rejects when enrollment not completed', () => {
    const res = validateCertificateEligibility(baseRequest, { ...enrollment, completed: false }, course);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Course is not completed yet');
  });

  it('rejects when student id mismatch', () => {
    const res = validateCertificateEligibility({ ...baseRequest, studentId: 'student-2' }, enrollment, course);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Enrollment does not match student/course');
  });

  it('rejects when mentor does not own course', () => {
    const res = validateCertificateEligibility(baseRequest, enrollment, { ...course, mentor_id: 'mentor-2' });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Mentor does not own this course');
  });
});
