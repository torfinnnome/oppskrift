import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: userId } = context.params;
  const session = await getServerSession(authOptions);

  // Check if the user is authenticated and has admin role
  if (!session || !session.user || !(session.user as any).roles?.includes('admin')) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
    });
    return NextResponse.json({ message: "User approved successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error approving user:", error);
    return NextResponse.json({ message: "Error approving user." }, { status: 500 });
  }
}
