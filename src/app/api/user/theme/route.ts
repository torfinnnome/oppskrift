import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { theme } = await req.json();

  if (!theme || !['light', 'dark'].includes(theme)) {
    return NextResponse.json({ message: 'Invalid theme value' }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { email: session.user.email },
      data: { theme },
    });
    return NextResponse.json({ message: 'Theme updated successfully' });
  } catch (error) {
    console.error('Error updating theme:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
