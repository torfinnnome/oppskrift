import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
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
    await prisma.user.delete({
      where: { id: userId },
    });
    return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ message: "Error deleting user." }, { status: 500 });
  }
}
