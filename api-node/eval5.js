
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
async function run() {
    const tt = await prisma.timetable.findFirst();
    console.log('Type of schedule:', typeof tt?.schedule);
    console.log('Is string?', typeof tt?.schedule === 'string');
    console.log('Value:', JSON.stringify(tt?.schedule).substring(0, 100));
}
run();

