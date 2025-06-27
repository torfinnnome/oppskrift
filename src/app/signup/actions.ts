
'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const signupSchema = z.object({
  displayName: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function signup(formData: FormData) {
  const values = Object.fromEntries(formData.entries());
  const parsed = signupSchema.safeParse(values);

  if (!parsed.success) {
    return {
      error: 'Invalid form data',
    };
  }

  const { email, password, displayName } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      error: 'auth/email-already-in-use',
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      displayName,
    },
  });

  return {
    success: true,
  };
}
