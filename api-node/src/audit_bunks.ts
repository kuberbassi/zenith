
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function audit() {
  const users = await prisma.user.findMany({ include: { preferences: true } });
  for (const user of users) {
    const subjects = await prisma.subject.findMany({ where: { user_id: user.id, semester: 2 } });
    const target = user.attendance_threshold || 75;
    
    let totalAttended = subjects.reduce((s, x) => s + (x.attended || 0), 0);
    let totalClasses = subjects.reduce((s, x) => s + (x.total || 0), 0);
    
    const overallPct = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
    const universalSafeBunks = totalClasses > 0 ? Math.max(0, Math.floor((totalAttended * 100 - target * totalClasses) / target)) : 0;
    
    let summedBunks = 0;
    for (const sub of subjects) {
        const subAttended = sub.attended || 0;
        const subTotal = sub.total || 0;
        const subTarget = sub.target || target;
        const subBunks = subTotal > 0 ? Math.max(0, Math.floor((subAttended * 100 - subTarget * subTotal) / subTarget)) : 0;
        summedBunks += subBunks;
    }

    console.log(`User: ${user.email}`);
    console.log(`- Overall Attendance: ${overallPct.toFixed(1)}% (Target: ${target}%)`);
    console.log(`- totalAttended: ${totalAttended}, totalClasses: ${totalClasses}`);
    console.log(`- Universal Safe Bunks: ${universalSafeBunks}`);
    console.log(`- Summed Safe Bunks: ${summedBunks}`);
    console.log('---');
  }
}

audit().catch(console.error).finally(() => prisma.$disconnect());
