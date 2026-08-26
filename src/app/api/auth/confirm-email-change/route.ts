import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaDirect } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  let baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl || (process.env.NODE_ENV === "production" && baseUrl.includes("localhost"))) {
    baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://anvilapp.online";
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?error=InvalidEmailChangeToken`);
  }

  try {
    // 1. Look up VerificationToken by token
    const verificationRecord = await prisma.verificationToken.findUnique({
      where: { token },
    });

    // 2. Check token exists and is not expired
    if (!verificationRecord || verificationRecord.expires < new Date()) {
      if (verificationRecord) {
        // Clean up expired token
        await prisma.verificationToken.deleteMany({
          where: { token },
        });
      }
      return NextResponse.redirect(`${baseUrl}/login?error=InvalidEmailChangeToken`);
    }

    // 3. Find the User whose pendingEmail matches token.identifier
    const user = await prisma.user.findFirst({
      where: { pendingEmail: verificationRecord.identifier },
    });

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?error=InvalidEmailChangeToken`);
    }

    // 4. Atomically swap email: User.email = User.pendingEmail, User.pendingEmail = null, delete token
    await prismaDirect.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: user.pendingEmail!,
          pendingEmail: null,
          emailVerified: new Date(),
        },
      });

      // Delete all verification tokens associated with this target email
      await tx.verificationToken.deleteMany({
        where: { identifier: verificationRecord.identifier },
      });
    });

    // 5. Redirect to login with emailChanged=true parameter so UI informs user to sign in with new email
    return NextResponse.redirect(`${baseUrl}/login?emailChanged=true`);
  } catch (error) {
    console.error("[confirm-email-change] Error confirming email change:", error);
    return NextResponse.redirect(`${baseUrl}/login?error=InvalidEmailChangeToken`);
  }
}
