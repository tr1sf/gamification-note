import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const formData = await request.formData();
  const file = formData.get("image") as File | null;
  if (!file) return error("VALIDATION_ERROR", "No image provided", 400);
  if (!["image/png", "image/jpeg"].includes(file.type)) return error("VALIDATION_ERROR", "Only PNG/JPEG allowed", 400);
  if (file.size > 2 * 1024 * 1024) return error("VALIDATION_ERROR", "Max 2MB", 400);

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  return success({ url: dataUrl, fileName: file.name, size: file.size });
}
