
'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
  secure: process.env.EMAIL_SERVER_SECURE === "true",
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

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

  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      displayName,
    },
  });

  // Notify admins about the new user
  const admins = await prisma.user.findMany({
    where: {
      roles: { contains: "admin" },
    },
  });

  for (const admin of admins) {
    const adminUserManagementUrl = `${process.env.NEXTAUTH_URL}/admin/users`;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: admin.email,
      subject: "New User Registration",
      html: `<p>A new user has registered:</p>
             <p>Email: ${newUser.email}</p>
             <p>Display Name: ${newUser.displayName || "N/A"}</p>
             <p>View user details: <a href="${adminUserManagementUrl}">${adminUserManagementUrl}</a></p>`,
    });
  }

  return {
    success: true,
  };
}
