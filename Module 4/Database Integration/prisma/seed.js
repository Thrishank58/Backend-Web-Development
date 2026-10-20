const prisma = require('../src/db/prisma');

// Seed data matches the original in-memory starter data.
const seedUser = { id: 1, name: 'Seed User', email: 'seed@example.com' };

const seedPosts = [
  { id: 1, title: 'First post', body: 'The contract survives storage changes.', authorId: 1 },
  { id: 2, title: 'Second post', body: 'Migrations record database design.', authorId: 1 },
];

async function main() {
  // Upsert ensures the script is safe to rerun without duplicating data.
  const user = await prisma.user.upsert({
    where: { id: seedUser.id },
    update: { name: seedUser.name },
    create: { id: seedUser.id, name: seedUser.name, email: seedUser.email },
  });

  for (const post of seedPosts) {
    await prisma.post.upsert({
      where: { id: post.id },
      update: { title: post.title, body: post.body },
      create: {
        id: post.id,
        title: post.title,
        body: post.body,
        authorId: user.id,
      },
    });
  }

  console.log('Seed complete – created user and 2 sample posts.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
