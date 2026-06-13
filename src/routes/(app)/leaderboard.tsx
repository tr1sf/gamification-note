import { onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  onMount(() => navigate("/progress", { replace: true }));
  return null;
}
