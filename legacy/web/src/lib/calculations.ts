import type { BunkGuardResult, RiskLevel } from '@/types'

export class AttendanceCalculator {
  static calculatePercentage(attended: number, total: number): number {
    if (total === 0) return 0
    return Math.round((attended / total) * 100 * 10) / 10
  }

  static getRiskLevel(percentage: number, target = 75): RiskLevel {
    if (percentage >= target) return 'safe'
    if (percentage >= target - 10) return 'warning'
    return 'danger'
  }

  /**
   * Calculate how many classes can be bunked while maintaining target %
   * or how many classes need to be attended to reach target %
   */
  static calculateBunkGuard(
    attended: number,
    total: number,
    target = 75,
  ): BunkGuardResult {
    const percentage = this.calculatePercentage(attended, total)
    const risk = this.getRiskLevel(percentage, target)

    if (percentage >= target) {
      // Can bunk: find max classes that can be missed
      // (attended / (total + x)) >= target/100
      // attended >= (target/100) * (total + x)
      // attended * 100 >= target * total + target * x
      // (attended * 100 - target * total) / target >= x
      const canBunk = Math.floor(
        (attended * 100 - target * total) / target,
      )
      return {
        percentage,
        can_bunk: canBunk,
        count: canBunk,
        status_message: `Can skip ${canBunk} class${canBunk !== 1 ? 'es' : ''}`,
        risk: 'safe',
      }
    } else {
      // Need to attend: find min classes to attend to reach target
      // (attended + x) / (total + x) >= target/100
      // 100(attended + x) >= target(total + x)
      // 100*attended + 100*x >= target*total + target*x
      // x(100 - target) >= target*total - 100*attended
      // x >= (target*total - 100*attended) / (100 - target)
      const needed = Math.ceil(
        (target * total - 100 * attended) / (100 - target),
      )
      return {
        percentage,
        can_bunk: 0,
        count: needed,
        status_message: `Attend ${needed} more to reach ${target}%`,
        risk: percentage < target - 10 ? 'danger' : 'warning',
      }
    }
  }

  static getAttendanceSummary(subjects: { attended: number; total: number }[]) {
    const totalAttended = subjects.reduce((s, sub) => s + sub.attended, 0)
    const totalClasses = subjects.reduce((s, sub) => s + sub.total, 0)
    return {
      totalAttended,
      totalClasses,
      overall: this.calculatePercentage(totalAttended, totalClasses),
    }
  }
}
