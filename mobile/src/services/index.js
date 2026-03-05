import api from './api';
import AuthService from './auth.service';
import DashboardService from './dashboard.service';
import AttendanceService from './attendance.service';
import AcademicService from './academic.service';
import TimetableService from './timetable.service';
import ProfileService from './profile.service';
import SkillsService from './skills.service';
import DataService from './data.service';
import ScraperService from './scraper.service';
import AiService from './ai.service';

export {
  api,
  AuthService,
  DashboardService,
  AttendanceService,
  AcademicService,
  TimetableService,
  ProfileService,
  SkillsService,
  DataService,
  ScraperService,
  AiService
};

export const attendanceService = {
  // Dashboard
  getDashboardData: (sem) => DashboardService.getDashboardData(sem),
  getReportsData: (sem) => DashboardService.getReportsData(sem),
  getNotifications: () => DashboardService.getNotifications(),
  getDayOfWeekAnalytics: (sem) => DashboardService.getDayOfWeekAnalytics(sem),

  // Attendance
  markAttendance: (p) => AttendanceService.markAttendance(p),
  markAllAttendance: (e) => AttendanceService.markAllAttendance(e),
  getAttendanceLogs: () => AttendanceService.getAttendanceLogs(),
  editAttendance: (id, u) => AttendanceService.editAttendance(id, u),
  deleteAttendance: (id) => AttendanceService.deleteAttendance(id),
  getCalendarData: (p, m, s) => {
    if (typeof p === 'object') return AttendanceService.getCalendarData(p);
    return AttendanceService.getCalendarData({ year: p, month: m, semester: s });
  },
  getClassesForDate: (d, s) => AttendanceService.getClassesForDate(d, s),
  getLogsForDate: (d) => AttendanceService.getLogsForDate(d),

  // Academic
  getSubjects: (s) => AcademicService.getSubjects(s),
  addSubject: (s) => AcademicService.addSubject(s),
  getSubjectDetails: (id) => AcademicService.getSubjectDetails(id),
  updateSubject: (id, u) => AcademicService.updateSubject(id, u),
  deleteSubject: (id) => AcademicService.deleteSubject(id),
  updateAttendanceCount: (id, a, t) => AcademicService.updateAttendanceCount(id, a, t),
  updateSubjectFullDetails: (id, d) => AcademicService.updateSubjectFullDetails(id, d),
  updatePracticals: (id, u) => AcademicService.updatePracticals(id, u),
  updateAssignments: (id, u) => AcademicService.updateAssignments(id, u),
  getFullSubjectsData: (s) => AcademicService.getFullSubjectsData(s),
  getSemesterResults: (s) => AcademicService.getResults(s),
  getSavedIPUResults: (s) => AcademicService.getResults(s),
  saveSemesterResult: (r) => AcademicService.saveResults(r),
  deleteSemesterResult: (s) => AcademicService.deleteResults(s),
  getManualCourses: () => AcademicService.getManualCourses(),
  addManualCourse: (c) => AcademicService.addManualCourse(c),
  saveManualCourses: (c) => AcademicService.addManualCourse(c),
  updateManualCourse: (id, u) => AcademicService.updateManualCourse(id, u),
  deleteManualCourse: (id) => AcademicService.deleteManualCourse(id),
  getAllSemestersOverview: () => AcademicService.getAllSemestersOverview(),

  // Timetable
  getTimetable: () => TimetableService.getTimetable(),
  saveTimetable: (t) => TimetableService.saveTimetable(t),
  saveTimetableStructure: (s) => TimetableService.saveTimetableStructure(s),
  addTimetableSlot: (s) => TimetableService.addSlot(s),
  updateTimetableSlot: (id, u) => TimetableService.updateSlot(id, u),
  deleteTimetableSlot: (id) => TimetableService.deleteSlot(id),
  getHolidays: () => TimetableService.getHolidays(),
  addHoliday: (h) => TimetableService.addHoliday(h),
  deleteHoliday: (id) => TimetableService.deleteHoliday(id),

  // Profile
  getProfile: () => ProfileService.getProfile(),
  updateProfile: (u) => ProfileService.updateProfile(u),
  uploadProfilePicture: (f) => ProfileService.uploadProfilePicture(f),
  getPreferences: () => ProfileService.getPreferences(),
  updatePreferences: (p) => ProfileService.savePreferences(p),
  getSystemLogs: () => ProfileService.getSystemLogs(),

  // Skills
  getSkills: () => SkillsService.getSkills(),
  addSkill: (s) => SkillsService.addSkill(s),
  updateSkill: (id, u) => SkillsService.updateSkill(id, u),
  deleteSkill: (id) => SkillsService.deleteSkill(id),

  // Data
  exportData: (f) => DataService.exportData(f),
  importData: (d) => DataService.importData(d),
  deleteAllData: () => DataService.deleteAllData(),
  getBackups: () => DataService.getBackups(),
  restoreBackup: (id) => DataService.restoreBackup(id),

  // Scraper
  getNotices: () => ScraperService.getNotices(),

  // AI
  chat: (m) => AiService.chat(m),
};

