/**
 * Matching Worker
 * 
 * Runs AI-powered matching for all users periodically
 * Can be scheduled via cron or triggered manually
 */

import { prisma } from '@dsk/db';
import { runMatchingForUser, createMatchChat } from '@dsk/integrations';

async function runMatchingWorker() {
  console.log('🚀 Starting matching worker...');
  const startTime = Date.now();

  try {
    // Get all users with at least one active goal
    const users = await prisma.user.findMany({
      where: {
        goals: {
          some: {
            status: 'active',
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        goals: {
          where: { status: 'active' },
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
    });

    console.log(`👥 Found ${users.length} users with active goals`);

    let totalMatches = 0;
    let chatsCreated = 0;

    // Run matching for each user
    for (const user of users) {
      console.log(`\n🔍 Processing user: ${user.name || user.email}`);

      try {
        // Find matches
        const matches = await runMatchingForUser(user.id, 5);
        totalMatches += matches.length;

        // Create chat rooms for top 3 matches
        const topMatches = matches.slice(0, 3);
        for (const match of topMatches) {
          try {
            const chatRoomId = await createMatchChat(
              user.id,
              match.matchedUserId,
              undefined // Could pass a shared goal ID
            );
            chatsCreated++;
            console.log(`  💬 Created chat room: ${chatRoomId}`);
          } catch (error) {
            console.error(`  ❌ Failed to create chat: ${(error as Error).message}`);
          }
        }

        // Small delay to avoid overwhelming the DB
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Error processing user ${user.id}: ${(error as Error).message}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n✅ Matching worker completed!');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Total matches found: ${totalMatches}`);
    console.log(`💬 Chat rooms created: ${chatsCreated}`);

  } catch (error) {
    console.error('❌ Worker failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  runMatchingWorker();
}

export { runMatchingWorker };
