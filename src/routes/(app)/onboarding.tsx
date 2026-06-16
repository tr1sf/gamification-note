import { useNavigate } from "@solidjs/router";
import OnboardingWizard from "~/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  const navigate = useNavigate();

  function handleComplete() {
    navigate("/tavern", { replace: true });
  }

  return <OnboardingWizard onComplete={handleComplete} />;
}
