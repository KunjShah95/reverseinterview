import { createServerFn } from "@tanstack/react-start";
import { auth, clerkClient } from "@clerk/tanstack-react-start/server";

async function getAuthUser() {
  const { userId } = await auth();
  if (!userId) return null;

  return clerkClient().users.getUser(userId);
}

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getAuthUser();
  if (!user) return { authenticated: false, user: null };

  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );

  const name =
    user.fullName ??
    [user.firstName, user.lastName].filter(Boolean).join(" ") ??
    user.username ??
    "User";

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: primaryEmail?.emailAddress ?? null,
      name,
      avatar: user.imageUrl ?? null,
    },
  };
});
