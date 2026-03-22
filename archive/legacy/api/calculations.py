# Calculation Engine for AcadHub
# All business logic for academic metrics

class AttendanceCalculator:
    """Calculate attendance percentages and predictions"""
    
    @staticmethod
    def calculate_attendance_percentage(attended: int, total: int) -> float:
        """
        Calculate percentage attendance
        Args:
            attended: Classes attended
            total: Total classes held
        Returns:
            Percentage (0-100)
        """
        if total == 0:
            return 0.0
        return (attended / total) * 100
    
    @staticmethod
    def predict_attendance_trend(records: list) -> dict:
        """
        ML-based attendance trend prediction
        Args:
            records: List of {'date': str, 'attended': bool}
        Returns:
            {'trend': 'improving'|'declining'|'stable', 'confidence': 0-1}
        """
        if len(records) < 3:
            return {'trend': 'insufficient_data', 'confidence': 0}
        
        # Simple moving average trend
        recent = [r['attended'] for r in records[-7:]]
        older = [r['attended'] for r in records[-14:-7]]
        
        recent_avg = sum(recent) / len(recent) if recent else 0
        older_avg = sum(older) / len(older) if older else 0
        
        if recent_avg > older_avg + 0.05:
            trend = 'improving'
        elif recent_avg < older_avg - 0.05:
            trend = 'declining'
        else:
            trend = 'stable'
        
        confidence = min(len(records) / 30, 1.0)  # Increase confidence with more data
        
        return {'trend': trend, 'confidence': confidence}
    
    @staticmethod
    def calculate_days_needed_for_target(current_attended: int, total_classes: int, 
                                        target_percentage: float) -> int:
        """
        Calculate how many consecutive classes needed to reach target attendance
        """
        if target_percentage <= 0 or target_percentage > 100:
            return 0
        
        target_decimal = target_percentage / 100
        needed = int((target_decimal * (total_classes + 1) - current_attended))
        
        return max(0, needed)


class GradeCalculator:
    """Calculate SGPA, CGPA, and grade points"""
    
    GRADE_POINTS = {
        'O': 4.0,   # Outstanding
        'A+': 3.7,  # Excellent
        'A': 3.3,   # Very Good
        'B+': 3.0,  # Good
        'B': 2.7,   # Above Average
        'C+': 2.3,  # Average
        'C': 2.0,   # Satisfactory
        'D': 1.0,   # Pass
        'F': 0.0,   # Fail
    }
    
    @staticmethod
    def calculate_sgpa(semester_courses: list) -> dict:
        """
        Calculate Semester GPA
        Args:
            semester_courses: [
                {'grade': 'A', 'credits': 3},
                {'grade': 'B+', 'credits': 4},
            ]
        Returns:
            {'sgpa': 3.45, 'total_credits': 7, 'grade_points': 24.15}
        """
        if not semester_courses:
            return {'sgpa': 0.0, 'total_credits': 0, 'grade_points': 0.0}
        
        total_credits = 0
        total_grade_points = 0.0
        
        for course in semester_courses:
            grade = course.get('grade', 'F')
            credits = course.get('credits', 0)
            
            grade_point = GradeCalculator.GRADE_POINTS.get(grade, 0.0)
            total_grade_points += grade_point * credits
            total_credits += credits
        
        sgpa = total_grade_points / total_credits if total_credits > 0 else 0.0
        
        return {
            'sgpa': round(sgpa, 2),
            'total_credits': total_credits,
            'grade_points': round(total_grade_points, 2)
        }
    
    @staticmethod
    def calculate_cgpa(all_semesters: list) -> dict:
        """
        Calculate Cumulative GPA
        Args:
            all_semesters: List of semester results with courses
        Returns:
            {'cgpa': 3.42, 'total_credits': 48, 'total_grade_points': 164.16}
        """
        if not all_semesters:
            return {'cgpa': 0.0, 'total_credits': 0, 'total_grade_points': 0.0}
        
        total_credits = 0
        total_grade_points = 0.0
        
        for semester in all_semesters:
            for course in semester.get('courses', []):
                grade = course.get('grade', 'F')
                credits = course.get('credits', 0)
                
                grade_point = GradeCalculator.GRADE_POINTS.get(grade, 0.0)
                total_grade_points += grade_point * credits
                total_credits += credits
        
        cgpa = total_grade_points / total_credits if total_credits > 0 else 0.0
        
        return {
            'cgpa': round(cgpa, 2),
            'total_credits': total_credits,
            'total_grade_points': round(total_grade_points, 2)
        }
    
    @staticmethod
    def grade_from_percentage(percentage: float) -> str:
        """Convert percentage to letter grade"""
        if percentage >= 90:
            return 'O'
        elif percentage >= 87:
            return 'A+'
        elif percentage >= 83:
            return 'A'
        elif percentage >= 80:
            return 'B+'
        elif percentage >= 77:
            return 'B'
        elif percentage >= 73:
            return 'C+'
        elif percentage >= 70:
            return 'C'
        elif percentage >= 60:
            return 'D'
        else:
            return 'F'
    
    @staticmethod
    def predict_grade_performance(current_marks: list, total_possible: float) -> dict:
        """
        Predict final grade based on current performance
        Args:
            current_marks: [45, 38, 42] - marks obtained in assessments
            total_possible: 100 - total possible marks
        Returns:
            {'predicted_grade': 'A', 'confidence': 0.85, 'trend': 'improving'}
        """
        if not current_marks:
            return {'predicted_grade': 'F', 'confidence': 0, 'trend': 'unknown'}
        
        avg_percentage = (sum(current_marks) / (len(current_marks) * total_possible)) * 100
        predicted_grade = GradeCalculator.grade_from_percentage(avg_percentage)
        
        # Check trend
        if len(current_marks) > 1:
            recent_avg = sum(current_marks[-2:]) / 2
            older_avg = sum(current_marks[:-2]) / len(current_marks[:-2]) if len(current_marks) > 2 else current_marks[0]
            trend = 'improving' if recent_avg > older_avg else 'declining' if recent_avg < older_avg else 'stable'
        else:
            trend = 'insufficient_data'
        
        confidence = min(len(current_marks) / 5, 1.0)
        
        return {
            'predicted_grade': predicted_grade,
            'predicted_percentage': round(avg_percentage, 2),
            'confidence': round(confidence, 2),
            'trend': trend
        }
