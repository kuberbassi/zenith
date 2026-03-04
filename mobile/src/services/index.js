/**
 * Service barrel export
 */

export { default as api } from './api';
export { API_URL } from './api';

export { default as AuthService } from './auth.service';
export * from './auth.service';

export { default as DashboardService } from './dashboard.service';
export * from './dashboard.service';

export { default as AttendanceService } from './attendance.service';
export * from './attendance.service';

export { default as AcademicService } from './academic.service';
export * from './academic.service';

export { default as TimetableService } from './timetable.service';
export * from './timetable.service';

export { default as ProfileService } from './profile.service';
export * from './profile.service';

export { default as SkillsService } from './skills.service';
export * from './skills.service';

export { default as DataService } from './data.service';
export * from './data.service';

export { default as ScraperService } from './scraper.service';
export * from './scraper.service';

// ────────────────────────────────────────────────────────────
// Backward-compatible facade  (maps old monolithic method names
// to the new domain-specific services so existing screens keep working)
// ────────────────────────────────────────────────────────────
import DashboardService from './dashboard.service';
import AttendanceService from './attendance.service';
import AcademicService from './academic.service';
import TimetableService from './timetable.service';
import ProfileService from './profile.service';
import SkillsService from './skills.service';
import DataService from './data.service';
import ScraperService from './scraper.service';

export const attendanceService = {
  // ── Dashboard ──
  getDashboardData: DashboardService.getDashboardData,
  getReportsData: DashboardService.getReportsData,
  getNotifications: DashboardService.getNotifications,
  getDayOfWeekAnalytics: DashboardService.getDayOfWeekAnalytics,

  // ── Attendance ──
  markAttendance: AttendanceService.markAttendance,
  markAllAttendance: AttendanceService.markAllAttendance,
  getAttendanceLogs: AttendanceService.getAttendanceLogs,
  editAttendance: AttendanceService.editAttendance,
  deleteAttendance: AttendanceService.deleteAttendance,
  getCalendarData: AttendanceService.getCalendarData,
  getClassesForDate: AttendanceService.getClassesForDate,
  getLogsForDate: AttendanceService.getLogsForDate,

  // ── Academic ──
  getSubjects: AcademicService.getSubjects,
  addSubject: AcademicService.addSubject,
  getSubjectDetails: AcademicService.getSubjectDetails,
  updateSubject: AcademicService.updateSubject,
  deleteSubject: AcademicService.deleteSubject,
  updateAttendanceCount: AcademicService.updateAttendanceCount,
  updateSubjectFullDetails: AcademicService.updateSubjectFullDetails,
  updatePracticals: AcademicService.updatePracticals,
  updateAssignments: AcademicService.updateAssignments,
  getFullSubjectsData: AcademicService.getFullSubjectsData,
  getSemesterResults: AcademicService.getResults,
  saveSemesterResult: AcademicService.saveResults,
  deleteSemesterResult: AcademicService.deleteResults,
  getManualCourses: AcademicService.getManualCourses,
  addManualCourse: AcademicService.addManualCourse,
  saveManualCourses: AcademicService.addManualCourse,
  updateManualCourse: AcademicService.updateManualCourse,
  deleteManualCourse: AcademicService.deleteManualCourse,
  getAllSemestersOverview: AcademicService.getAllSemestersOverview,

  // ── Timetable ──
  getTimetable: TimetableService.getTimetable,
  saveTimetable: TimetableService.saveTimetable,
  saveTimetableStructure: TimetableService.saveTimetableStructure,
  addTimetableSlot: TimetableService.addSlot,
  updateTimetableSlot: TimetableService.updateSlot,
  deleteTimetableSlot: TimetableService.deleteSlot,
  getHolidays: TimetableService.getHolidays,
  addHoliday: TimetableService.addHoliday,
  deleteHoliday: TimetableService.deleteHoliday,

  // ── Profile ──
  getProfile: ProfileService.getProfile,
  updateProfile: ProfileService.updateProfile,
  uploadProfilePicture: ProfileService.uploadProfilePicture,
  getPreferences: ProfileService.getPreferences,
  updatePreferences: ProfileService.savePreferences,
  getSystemLogs: ProfileService.getSystemLogs,

  // ── Skills ──
  getSkills: SkillsService.getSkills,
  addSkill: SkillsService.addSkill,
  updateSkill: SkillsService.updateSkill,
  deleteSkill: SkillsService.deleteSkill,

  // ── Data ──
  exportData: DataService.exportData,
  importData: DataService.importData,
  deleteAllData: DataService.deleteAllData,
  getBackups: DataService.getBackups,
  restoreBackup: DataService.restoreBackup,

  // ── Scraper ──
  getNotices: ScraperService.getNotices,
};
