import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SUBJECTS = [
  { name: 'Data Structures and Algorithms', code: 'CS201' },
  { name: 'Database Management Systems', code: 'CS202' },
  { name: 'Operating Systems', code: 'CS203' },
  { name: 'Computer Networks', code: 'CS204' },
  { name: 'Mathematics III', code: 'MA301' },
  { name: 'Software Engineering', code: 'CS205' },
  { name: 'Machine Learning', code: 'CS306' },
  { name: 'Compiler Design', code: 'CS307' },
];

async function main() {
  const email = process.env.TEACHER_EMAIL ?? 'teacher@school.edu';
  const password = process.env.TEACHER_PASSWORD ?? 'Teacher@123';
  const name = process.env.TEACHER_NAME ?? 'Default Teacher';

  const existing = await prisma.teacher.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.teacher.create({
      data: { email, passwordHash, name },
    });
    console.log(`Created default teacher: ${email}`);
  } else {
    console.log(`Teacher already exists: ${email}`);
  }

  for (const subject of DEFAULT_SUBJECTS) {
    const found = await prisma.subject.findUnique({ where: { code: subject.code } });
    if (!found) {
      await prisma.subject.create({ data: subject });
      console.log(`Created subject: ${subject.name} (${subject.code})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
