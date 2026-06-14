import { getUserFromRequest } from "~/lib/auth/get-user";
import { runNudgeEngine } from "~/lib/notifications/nudge-engine";
import { success } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return new Response(JSON.stringify({ success: true }));
  runNudgeEngine(user.userId).catch(() => {});
  return success({ triggered: true });
}
