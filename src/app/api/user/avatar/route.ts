import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function detectImageType(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return "image/jpeg";
  }

  // WebP: RIFF .... WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // 1. Validate File Size (max 2MB = 2,097,152 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 2MB limit" },
        { status: 400 }
      );
    }

    // 2. Validate File Magic Bytes (Content Type inspection)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const detectedType = detectImageType(buffer);

    if (!detectedType) {
      return NextResponse.json(
        { error: "Invalid image file. Only JPEG, PNG, and WebP images are allowed." },
        { status: 400 }
      );
    }

    // 3. Determine File Extension
    let ext = "png";
    if (detectedType === "image/jpeg") ext = "jpg";
    if (detectedType === "image/webp") ext = "webp";

    const timestamp = Date.now();
    const storagePath = `${userId}/${timestamp}.${ext}`;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mfjnufslktmuevjtdylv.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;

    // 4. Guard against missing Supabase credentials — fail loudly, NEVER silently
    if (!supabaseKey) {
      console.error("Avatar upload failed: Supabase API key is missing from environment");
      return NextResponse.json(
        { error: "Storage configuration is missing on server" },
        { status: 500 }
      );
    }

    // 5. Upload to Supabase Storage Bucket 'avatars'
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, buffer, {
        contentType: detectedType,
        upsert: false,
      });

    if (uploadError || !uploadData?.path) {
      console.error("Supabase storage upload error:", uploadError);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError?.message || "No upload path returned"}` },
        { status: 500 }
      );
    }

    // 6. Only write to Database once storage upload is 100% verified
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${uploadData.path}`;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
      select: { id: true, avatarUrl: true },
    });

    return NextResponse.json({
      avatarUrl: updatedUser.avatarUrl,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    console.error("POST /api/user/avatar error:", error);
    return NextResponse.json(
      { error: "Internal server error during avatar upload" },
      { status: 500 }
    );
  }
}
