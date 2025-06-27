import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id; // Assuming NextAuth session provides user ID
  const { displayName, email, newPassword, currentPassword } = await req.json();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const updateData: { displayName?: string; email?: string; password?: string } = {};

    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }

    if (email !== undefined && email !== user.email) {
      if (!currentPassword) {
        return NextResponse.json({ message: "Current password is required to change email" }, { status: 400 });
      }
      if (!user.password || !bcrypt.compareSync(currentPassword, user.password)) {
        return NextResponse.json({ message: "Incorrect current password" }, { status: 401 });
      }
      updateData.email = email;
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ message: "Current password is required to set a new password" }, { status: 400 });
      }
      if (!user.password || !bcrypt.compareSync(currentPassword, user.password)) {
        return NextResponse.json({ message: "Incorrect current password" }, { status: 401 });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Invalidate session to force re-fetch of updated user data
    // This is typically handled by `update()` in `useSession` on the client

    return NextResponse.json({ message: "Profile updated", user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { message: "Error updating profile", error: error.message },
      { status: 500 }
    );
  }
}