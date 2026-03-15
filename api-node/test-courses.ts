import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.manualCourse.findMany().then(r => console.log(r));
