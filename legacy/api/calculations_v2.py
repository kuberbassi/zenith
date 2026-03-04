# COMPLETE CALCULATION ENGINE - All Academic Metrics

from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import statistics

class AttendanceCalculator:
    """Advanced attendance tracking and predictions"""
    
    # Risk levels and thresholds
    RISK_THRESHOLD_SAFE = 75.0
    RISK_THRESHOLD_WARNING = 60.0
    RISK_THRESHOLD_CRITICAL = 50.0
    
    @staticmethod
    def calculate_percentage(attended: int, total: int) -> float:
        """Calculate attendance percentage"""
        if total == 0:
            return 0.0
        return round((attended / total) * 100, 2)

    @staticmethod
    def calculate_bunk_guard(attended: int, total: int, target: int = 75) -> Dict:
        """Determines how many classes can be bunked or must be attended."""
        pct = AttendanceCalculator.calculate_percentage(attended, total)
        
        if pct >= target:
            # Can bunk
            # (attended) / (total + x) = target/100
            # attended * 100 = target * total + target * x
            # x = (attended * 100 - target * total) / target
            can_bunk = int((attended * 100 - target * total) / target)
            return {
                "percentage": pct,
                "can_bunk": True,
                "count": can_bunk,
                "status_message": f"You can bunk {can_bunk} more classes." if can_bunk > 0 else "On the edge! Don't bunk."
            }
        else:
            # Must attend
            # (attended + x) / (total + x) = target/100
            # 100attended + 100x = target*total + target*x
            # x(100 - target) = target*total - 100attended
            # x = (target*total - 100attended) / (100 - target)
            must_attend = int(((target * total) - (100 * attended)) / (100 - target))
            if ((target * total) - (100 * attended)) % (100 - target) != 0:
                must_attend += 1
                
            return {
                "percentage": pct,
                "can_bunk": False,
                "count": must_attend,
                "status_message": f"Attend next {must_attend} classes to reach {target}%."
            }

    @staticmethod
    def get_risk_level(percentage: float) -> Tuple[str, str]:
        """Get risk level and color"""
        if percentage >= AttendanceCalculator.RISK_THRESHOLD_SAFE:
            return "Safe", "green"
        elif percentage >= AttendanceCalculator.RISK_THRESHOLD_WARNING:
            return "Warning", "orange"
        elif percentage >= AttendanceCalculator.RISK_THRESHOLD_CRITICAL:
            return "Critical", "red"
        else:
            return "Danger", "darkred"
    
    @staticmethod
    def calculate_days_needed(attended: int, total: int, target: float) -> int:
        """
        Calculate consecutive classes needed to reach target attendance
        
        Formula: (target% × (total + x) - attended) = x
        Solving for x gives days needed
        """
        if target <= 0 or target > 100:
            return 0
        
        target_decimal = target / 100.0
        # Need to attend all future classes to reach target
        days_needed = max(0, int(
            (target_decimal * total - attended) / (1 - target_decimal)
        ))
        
        return days_needed if days_needed >= 0 else 0
    
    @staticmethod
    def get_attendance_summary(subjects: List[Dict]) -> Dict:
        """Get overall attendance summary across all subjects"""
        if not subjects:
            return {
                'overall_percentage': 0.0,
                'total_attended': 0,
                'total_classes': 0,
                'subject_count': 0,
                'risk_level': 'No Data',
                'color': 'gray'
            }
        
        total_attended = sum(s.get('attended', 0) for s in subjects)
        total_classes = sum(s.get('total', 0) for s in subjects)
        
        overall_pct = AttendanceCalculator.calculate_percentage(total_attended, total_classes)
        risk_level, color = AttendanceCalculator.get_risk_level(overall_pct)
        
        return {
            'overall_percentage': overall_pct,
            'total_attended': total_attended,
            'total_classes': total_classes,
            'subject_count': len(subjects),
            'risk_level': risk_level,
            'color': color
        }


class GradeCalculator:
    """Complete grade and GPA calculation system"""
    
    # Grade point scale (4.0 system)
    GRADE_SCALE = {
        'O': 4.0,    # Outstanding (90-100)
        'A+': 3.7,   # Excellent (87-89)
        'A': 3.3,    # Very Good (83-86)
        'B+': 3.0,   # Good (80-82)
        'B': 2.7,    # Above Average (77-79)
        'C+': 2.3,   # Average (73-76)
        'C': 2.0,    # Satisfactory (70-72)
        'D': 1.0,    # Pass (60-69)
        'F': 0.0     # Fail (<60)
    }
    
    # Percentage ranges for grades
    PERCENTAGE_TO_GRADE = [
        (90, 'O'),
        (87, 'A+'),
        (83, 'A'),
        (80, 'B+'),
        (77, 'B'),
        (73, 'C+'),
        (70, 'C'),
        (60, 'D'),
        (0, 'F')
    ]
    
    # IPU Grade Points (10-point scale)
    IPU_GRADE_SCALE = {
        'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C+': 5, 'C': 4, 'F': 0
    }

    @staticmethod
    def calculate_subject_result(subject: Dict) -> Dict:
        """IPU Calculation Logic for a single subject."""
        internal_t = float(subject.get('internal_theory', 0) or 0)
        external_t = float(subject.get('external_theory', 0) or 0)
        internal_p = float(subject.get('internal_practical', 0) or 0)
        external_p = float(subject.get('external_practical', 0) or 0)
        
        total = internal_t + external_t + internal_p + external_p
        # Most IPU subjects are out of 100
        max_marks = 100 
        percentage = (total / max_marks) * 100
        
        # IPU Grading Scheme (approximate simplified)
        grade = 'F'
        if percentage >= 90: grade = 'O'
        elif percentage >= 75: grade = 'A+'
        elif percentage >= 65: grade = 'A'
        elif percentage >= 55: grade = 'B+'
        elif percentage >= 50: grade = 'B'
        elif percentage >= 45: grade = 'C+'
        elif percentage >= 40: grade = 'C'
        
        return {
            'total_marks': round(total, 2),
            'max_marks': max_marks,
            'percentage': round(percentage, 2),
            'grade': grade,
            'grade_point': GradeCalculator.IPU_GRADE_SCALE.get(grade, 0)
        }

    @staticmethod
    def percentage_to_grade(percentage: float) -> str:
        """Convert percentage to grade"""
        for min_pct, grade in GradeCalculator.PERCENTAGE_TO_GRADE:
            if percentage >= min_pct:
                return grade
        return 'F'
    
    @staticmethod
    def grade_to_points(grade: str) -> float:
        """Get grade points for a grade"""
        return GradeCalculator.GRADE_SCALE.get(grade, 0.0)
    
    @staticmethod
    def calculate_sgpa(courses: List[Dict]) -> Dict:
        """
        Calculate Semester GPA
        
        Args:
            courses: [
                {'grade': 'A', 'credits': 3, 'name': 'Math'},
                {'grade': 'B+', 'credits': 4, 'name': 'Physics'}
            ]
        
        Returns:
            {
                'sgpa': 3.45,
                'total_credits': 7,
                'total_grade_points': 24.15,
                'course_breakdown': [...],
                'grade_distribution': {...}
            }
        """
        if not courses:
            return {
                'sgpa': 0.0,
                'total_credits': 0,
                'total_grade_points': 0.0,
                'course_breakdown': [],
                'grade_distribution': {}
            }
        
        total_credits = 0
        total_grade_points = 0.0
        course_breakdown = []
        grade_dist = {}
        
        for course in courses:
            grade = course.get('grade', 'F')
            credits = course.get('credits', 0)
            name = course.get('name', 'Unknown')
            
            grade_points = GradeCalculator.IPU_GRADE_SCALE.get(grade, 0)
            course_grade_points = grade_points * credits
            
            total_grade_points += course_grade_points
            total_credits += credits
            
            # Track grade distribution
            grade_dist[grade] = grade_dist.get(grade, 0) + 1
            
            # Course breakdown
            course_breakdown.append({
                'name': name,
                'grade': grade,
                'credits': credits,
                'grade_points': grade_points,
                'contribution': round(course_grade_points, 2)
            })
        
        sgpa = total_grade_points / total_credits if total_credits > 0 else 0.0
        
        return {
            'sgpa': round(sgpa, 2),
            'total_credits': total_credits,
            'total_grade_points': round(total_grade_points, 2),
            'course_breakdown': course_breakdown,
            'grade_distribution': grade_dist,
            'average_grade': GradeCalculator._get_average_grade(courses)
        }
    
    @staticmethod
    def calculate_cgpa(semesters: List[List[Dict]]) -> Dict:
        """
        Calculate Cumulative GPA across all semesters
        
        Args:
            semesters: [[{course1}, {course2}], [{course3}, {course4}], ...]
        
        Returns:
            {
                'cgpa': 3.42,
                'total_credits': 48,
                'total_grade_points': 164.16,
                'semester_breakdown': [...],
                'cumulative_trend': [...]
            }
        """
        if not semesters or not any(semesters):
            return {
                'cgpa': 0.0,
                'total_credits': 0,
                'total_grade_points': 0.0,
                'semester_breakdown': [],
                'cumulative_trend': []
            }
        
        total_credits = 0
        total_grade_points = 0.0
        semester_breakdown = []
        cumulative_trend = []
        cumulative_cgpa = 0.0
        
        for sem_idx, courses in enumerate(semesters, 1):
            if not courses:
                continue
            
            sem_result = GradeCalculator.calculate_sgpa(courses)
            
            total_credits += sem_result['total_credits']
            total_grade_points += sem_result['total_grade_points']
            
            current_cgpa = total_grade_points / total_credits if total_credits > 0 else 0.0
            
            semester_breakdown.append({
                'semester': sem_idx,
                'sgpa': sem_result['sgpa'],
                'credits': sem_result['total_credits'],
                'grade_points': sem_result['total_grade_points'],
                'courses': len(courses)
            })
            
            cumulative_trend.append({
                'semester': sem_idx,
                'cgpa': round(current_cgpa, 2)
            })
            
            cumulative_cgpa = current_cgpa
        
        cgpa = total_grade_points / total_credits if total_credits > 0 else 0.0
        
        return {
            'cgpa': round(cgpa, 2),
            'total_credits': total_credits,
            'total_grade_points': round(total_grade_points, 2),
            'semester_count': len(semester_breakdown),
            'semester_breakdown': semester_breakdown,
            'cumulative_trend': cumulative_trend,
            'best_semester': max(semester_breakdown, key=lambda x: x['sgpa']) if semester_breakdown else None,
            'improvement_index': GradeCalculator._calculate_improvement(cumulative_trend)
        }
    
    @staticmethod
    def _get_average_grade(courses: List[Dict]) -> str:
        """Get average grade from courses"""
        if not courses:
            return 'F'
        grades = [c.get('grade', 'F') for c in courses]
        avg_points = statistics.mean(GradeCalculator.grade_to_points(g) for g in grades)
        
        for points, grade in sorted([(v, k) for k, v in GradeCalculator.GRADE_SCALE.items()], reverse=True):
            if avg_points >= points:
                return grade
        return 'F'
    
    @staticmethod
    def _calculate_improvement(trend_data: List[Dict]) -> float:
        """Calculate improvement index from trend"""
        if len(trend_data) < 2:
            return 0.0
        
        cgpas = [t['cgpa'] for t in trend_data]
        improvement = cgpas[-1] - cgpas[0]
        return round(improvement, 2)
