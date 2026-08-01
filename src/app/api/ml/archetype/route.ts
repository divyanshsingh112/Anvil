import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { triggerLazyArchetypeClassification } from "@/lib/services/archetype-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { result } = await triggerLazyArchetypeClassification(
      session.user.id,
      undefined,
      true // force fresh computation for direct API calls
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/ml/archetype error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
