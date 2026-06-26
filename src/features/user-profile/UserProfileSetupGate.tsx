import { UserProfileSetupView } from "./ui/UserProfileSetup";
import { useProfileSetup } from "./useProfileSetup";

export function UserProfileSetup() {
  const setup = useProfileSetup();

  if (setup.isComplete) {
    return null;
  }

  const { isComplete: _, ...viewProps } = setup;
  return <UserProfileSetupView {...viewProps} />;
}
