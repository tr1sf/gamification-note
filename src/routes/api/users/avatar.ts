import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const formData = await request.formData();
  const file = formData.get("avatar") as File | null;
  if (!file) return error("VALIDATION_ERROR", "No image provided", 400);
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return error("VALIDATION_ERROR", "Only PNG, JPEG, or WebP allowed", 400);
  if (file.size > 2 * 1024 * 1024)
    return error("VALIDATION_ERROR", "Max 2MB", 400);

  // Convert to base64 data URL for simplicity
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  await prisma.user.update({
    where: { id: user.userId },
    data: { avatarUrl: dataUrl },
  });

  return success({ avatarUrl: dataUrl });
}
