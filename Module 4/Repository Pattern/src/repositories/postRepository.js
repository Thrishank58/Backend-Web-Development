/**
 * Repository Migration Notes (Transitioning to a Prisma-backed implementation):
 *
 * What will CHANGE when replaced by Prisma:
 * 1. Storage Mechanism & Persistence:
 *    - In-memory data store (Map) and manual ID counter (`nextId`) will be replaced
 *      by Prisma Client queries against a persistent database (e.g., PostgreSQL).
 *    - ID generation will be handled natively by the database (e.g., auto-incrementing serial IDs).
 *    - Records will persist across server restarts instead of residing in volatile process memory.
 * 2. Asynchronous Execution:
 *    - Repository methods will become asynchronous (returning Promises) to handle database I/O.
 *    - Consumers in the service layer will use `await` when calling repository methods.
 * 3. Database & Error Semantics:
 *    - Query construction, connection pooling, transactions, and Prisma-specific errors
 *      (such as P2025 for record not found on updates/deletes) will be managed at the data access layer.
 *
 * What will REMAIN UNCHANGED:
 * 1. Repository Contract & Standard Operations:
 *    - The public interface of the repository will still expose the same standard operations:
 *      `findAll()`, `findById(id)`, `create(fields)`, `update(id, patch)`, and `remove(id)`.
 * 2. Domain Data Contracts & Return Shapes:
 *    - `findAll()` will return an array of post objects.
 *    - `findById(id)` will return the matching post object or `null` if not found.
 *    - `create(fields)` will return the complete created post record including its ID.
 *    - `update(id, patch)` will return the updated record or null when the ID does not exist.
 *    - `remove(id)` will return a boolean indicating whether a record was deleted.
 * 3. Architectural Boundary & Separation of Concerns:
 *    - Business logic and input validation (e.g., verifying `title` is present, throwing 422 errors)
 *      remain encapsulated within the service layer (`postService`).
 *    - Controllers continue to interact exclusively through services and remain decoupled from data access details.
 */

// Storage-swap proof: Map-backed store implementation
const posts = new Map([
  [1, { id: 1, title: 'First post', body: 'Repository boundaries protect change.', authorId: 7 }],
  [2, { id: 2, title: 'Second post', body: 'Services should speak in domain language.', authorId: 8 }],
]);

let nextId = 3;

function findAll() {
  return Array.from(posts.values()).map((post) => ({ ...post }));
}

function findById(id) {
  const post = posts.get(Number(id));
  return post ? { ...post } : null;
}

function create(fields) {
  const post = {
    id: nextId++,
    title: fields.title,
    body: fields.body || '',
    authorId: fields.authorId,
  };
  posts.set(post.id, post);
  return { ...post };
}

function update(id, patch) {
  const numericId = Number(id);
  const post = posts.get(numericId);
  if (!post) return null;

  if (patch.title !== undefined) post.title = patch.title;
  if (patch.body !== undefined) post.body = patch.body;
  if (patch.authorId !== undefined) post.authorId = patch.authorId;

  return { ...post };
}

function remove(id) {
  const numericId = Number(id);
  return posts.delete(numericId);
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
