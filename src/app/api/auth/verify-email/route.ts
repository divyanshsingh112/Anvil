import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=InvalidVerificationToken", request.url));
  }

  try {
    // Find the verification token
    const verificationRecord = await prisma.verificationToken.findUnique({
      where: { token },
    });

    // Check if token exists and is not expired
    if (!verificationRecord || verificationRecord.expires < new Date()) {
      // Clean up expired token if found
      if (verificationRecord) {
        await prisma.verificationToken.deleteMany({
          where: { token },
        });
      }
      return NextResponse.redirect(new URL("/login?error=InvalidVerificationToken", request.url));
    }

    // Single-use token: Update user emailVerified and delete token atomically
    await prisma.$transaction(async (tx) => {
      // Verify the user matching the identifier (email)
      await tx.user.updateMany({
        where: { email: verificationRecord.identifier },
        data: { emailVerified: new Date() },
      });

      // Delete the used token immediately so it cannot be replayed
      await tx.verificationToken.delete({
        where: { token },
      });

      // Also clean up any other pending verification tokens for this email
      await tx.verificationToken.deleteMany({
        where: { identifier: verificationRecord.identifier },
      });
    });

    return NextResponse.redirect(new URL("/login?verified=true", request.url));
  } catch (error) {
    console.error("[verify-email] Error processing token:", error);
    return NextResponse.redirect(new URL("/login?error=InvalidVerificationToken", request.url));
  }
}
