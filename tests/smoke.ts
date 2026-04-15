import assert from 'node:assert/strict';
import { validateCertificateEligibility } from '../src/lib/certificateValidation';

function runCertificateEligibilityTests() {
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

  const valid = validateCertificateEligibility(baseRequest, enrollment, course);
  assert.equal(valid.valid, true);

  const incomplete = validateCertificateEligibility(
    baseRequest,
    { ...enrollment, completed: false },
    course,
  );
  assert.equal(incomplete.valid, false);
  assert.equal(incomplete.reason, 'Course is not completed yet');

  const mismatchedStudent = validateCertificateEligibility(
    { ...baseRequest, studentId: 'student-2' },
    enrollment,
    course,
  );
  assert.equal(mismatchedStudent.valid, false);
  assert.equal(mismatchedStudent.reason, 'Enrollment does not match student/course');

  const wrongMentor = validateCertificateEligibility(
    baseRequest,
    enrollment,
    { ...course, mentor_id: 'mentor-2' },
  );
  assert.equal(wrongMentor.valid, false);
  assert.equal(wrongMentor.reason, 'Mentor does not own this course');
}

runCertificateEligibilityTests();
console.log('Smoke tests passed.');
