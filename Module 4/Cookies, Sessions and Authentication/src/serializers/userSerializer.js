/**
 * Explicit safe-field allowlist for user serialization.
 * Strips passwordHash and internal metadata to prevent accidental leaks.
 *
 * @param {object|null} user
 * @returns {{ id: number, name: string, email: string }|null}
 */
function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

module.exports = {
  serializeUser,
};
