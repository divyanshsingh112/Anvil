/**
 * Resolves the display avatar URL based on user settings and gender fallback.
 * Priority:
 * 1. User.avatarUrl (custom uploaded pfp)
 * 2. User.gender === "Male" -> /avatars/default-male.svg
 * 3. User.gender === "Female" -> /avatars/default-female.svg
 * 4. Fallback -> /avatars/default-neutral.svg
 */
export function getAvatarSrc(avatarUrl?: string | null, gender?: string | null): string {
  if (avatarUrl && typeof avatarUrl === "string" && avatarUrl.trim().length > 0) {
    return avatarUrl.trim();
  }

  const normalizedGender = gender?.trim().toLowerCase();
  if (normalizedGender === "male") {
    return "/avatars/default-male.svg";
  }
  if (normalizedGender === "female") {
    return "/avatars/default-female.svg";
  }

  return "/avatars/default-neutral.svg";
}
