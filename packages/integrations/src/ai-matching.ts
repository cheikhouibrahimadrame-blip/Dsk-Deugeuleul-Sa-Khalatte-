import { prisma } from '../membership';

/**
 * AI-Powered Matching Service
 * 
 * Matches users based on:
 * 1. Goal similarity (semantic + category)
 * 2. Shared interests and complementary skills
 * 3. Activity patterns and engagement
 * 4. Compatibility scoring
 */

export interface MatchResult {
  userId: string;
  matchedUserId: string;
  score: number; // 0.0 to 1.0
  reason: string;
  sharedGoals: string[];
  sharedInterests: string[];
  complementarySkills: string[];
}

/**
 * Calculate similarity between two text strings using simple cosine similarity
 * In production, replace with actual embeddings (OpenAI, Cohere, etc.)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  const allWords = new Set([...words1, ...words2]);
  
  if (allWords.size === 0) return 0;
  
  const vec1 = words1.map(w => allWords.has(w) ? 1 : 0);
  const vec2 = words2.map(w => allWords.has(w) ? 1 : 0);
  
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate array similarity (for interests/skills)
 */
function calculateArraySimilarity(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;
  
  const set1 = new Set(arr1.map(s => s.toLowerCase()));
  const set2 = new Set(arr2.map(s => s.toLowerCase()));
  
  const intersection = [...set1].filter(item => set2.has(item));
  const union = new Set([...arr1, ...arr2]).size;
  
  return intersection.length / union;
}

/**
 * Find matching items between two arrays
 */
function findMatches(arr1: string[], arr2: string[]): string[] {
  const set2 = new Set(arr2.map(s => s.toLowerCase()));
  return arr1.filter(item => set2.has(item.toLowerCase()));
}

/**
 * Find complementary (non-overlapping) items
 */
function findComplementary(arr1: string[], arr2: string[]): string[] {
  const set1 = new Set(arr1.map(s => s.toLowerCase()));
  return arr2.filter(item => !set1.has(item.toLowerCase()));
}

/**
 * Generate AI-powered match recommendations for a user
 */
export async function findMatchesForUser(
  userId: string,
  limit: number = 10
): Promise<MatchResult[]> {
  // Get user with goals, interests, skills
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      goals: {
        where: { status: 'active' },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get all other active users
  const otherUsers = await prisma.user.findMany({
    where: {
      id: { not: userId },
    },
    include: {
      goals: {
        where: { status: 'active' },
      },
    },
  });

  const matches: MatchResult[] = [];

  for (const otherUser of otherUsers) {
    // Calculate goal similarity
    const goalScores: number[] = [];
    const sharedGoals: string[] = [];

    for (const userGoal of user.goals) {
      for (const otherGoal of otherUser.goals) {
        // Category match
        const categoryMatch = userGoal.category && otherGoal.category &&
          userGoal.category.toLowerCase() === otherGoal.category.toLowerCase()
          ? 1.0
          : 0;

        // Description similarity
        const descSimilarity = calculateTextSimilarity(
          userGoal.description || '',
          otherGoal.description || ''
        );

        // Title similarity
        const titleSimilarity = calculateTextSimilarity(
          userGoal.title,
          otherGoal.title
        );

        const score = (categoryMatch * 0.4 + descSimilarity * 0.4 + titleSimilarity * 0.2);
        
        if (score > 0.3) {
          goalScores.push(score);
          sharedGoals.push(otherGoal.title);
        }
      }
    }

    const avgGoalScore = goalScores.length > 0
      ? goalScores.reduce((a, b) => a + b, 0) / goalScores.length
      : 0;

    // Calculate interests similarity
    const interestsScore = calculateArraySimilarity(user.interests, otherUser.interests);
    const sharedInterests = findMatches(user.interests, otherUser.interests);

    // Calculate skills complementarity
    const complementarySkills = findComplementary(user.skills, otherUser.skills);
    const skillsScore = complementarySkills.length > 0 ? 0.3 : 0; // Bonus for complementary skills

    // Calculate overall score
    const overallScore = (
      avgGoalScore * 0.5 +      // 50% goal similarity
      interestsScore * 0.3 +    // 30% shared interests
      skillsScore * 0.2         // 20% complementary skills
    );

    // Only include if score is above threshold
    if (overallScore >= 0.2) {
      // Generate reason
      const reasons: string[] = [];
      if (avgGoalScore > 0.5) reasons.push('Similar goals');
      if (sharedInterests.length > 0) reasons.push(`${sharedInterests.length} shared interests`);
      if (complementarySkills.length > 0) reasons.push('Complementary skills');

      matches.push({
        userId: user.id,
        matchedUserId: otherUser.id,
        score: Math.min(overallScore, 1.0),
        reason: reasons.join(', ') || 'General compatibility',
        sharedGoals: sharedGoals.slice(0, 3),
        sharedInterests: sharedInterests.slice(0, 5),
        complementarySkills: complementarySkills.slice(0, 3),
      });
    }
  }

  // Sort by score and limit
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Save match scores to database
 */
export async function saveMatchScores(matches: MatchResult[]): Promise<void> {
  const data = matches.map(match => ({
    userIdOne: match.userId,
    userIdTwo: match.matchedUserId,
    score: match.score,
    reason: match.reason,
  }));

  await prisma.matchScore.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * Get top matches for a user from database
 */
export async function getTopMatchesForUser(
  userId: string,
  limit: number = 10
): Promise<MatchResult[]> {
  const matchScores = await prisma.matchScore.findMany({
    where: {
      OR: [
        { userIdOne: userId },
        { userIdTwo: userId },
      ],
    },
    orderBy: { score: 'desc' },
    take: limit,
    include: {
      userOne: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          interests: true,
          skills: true,
        },
      },
      userTwo: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          interests: true,
          skills: true,
        },
      },
    },
  });

  return matchScores.map(match => {
    const isUserOne = match.userIdOne === userId;
    const otherUser = isUserOne ? match.userTwo : match.userOne;

    return {
      userId,
      matchedUserId: otherUser.id,
      score: match.score,
      reason: match.reason || 'Compatibility match',
      sharedGoals: [],
      sharedInterests: findMatches(
        isUserOne ? match.userOne.interests : match.userTwo.interests,
        isUserOne ? match.userTwo.interests : match.userOne.interests
      ),
      complementarySkills: findComplementary(
        isUserOne ? match.userOne.skills : match.userTwo.skills,
        isUserOne ? match.userTwo.skills : match.userOne.skills
      ),
    };
  });
}

/**
 * Create a chat room between matched users
 */
export async function createMatchChat(
  userId1: string,
  userId2: string,
  goalId?: string
): Promise<string> {
  // Check if chat already exists
  const existingChat = await prisma.chatRoom.findFirst({
    where: {
      type: 'direct',
      members: {
        every: {
          userId: { in: [userId1, userId2] },
        },
      },
    },
    include: {
      members: true,
    },
  });

  if (existingChat && existingChat.members.length === 2) {
    return existingChat.id;
  }

  // Create new chat room
  const chatRoom = await prisma.chatRoom.create({
    data: {
      type: 'direct',
      goalId,
      members: {
        create: [
          { userId: userId1 },
          { userId: userId2 },
        ],
      },
    },
  });

  return chatRoom.id;
}

/**
 * Main function: Find matches and create chat rooms
 */
export async function runMatchingForUser(
  userId: string,
  limit: number = 10
): Promise<MatchResult[]> {
  console.log(`🔍 Finding matches for user ${userId}...`);

  // Find matches
  const matches = await findMatchesForUser(userId, limit);
  console.log(`✅ Found ${matches.length} potential matches`);

  // Save to database
  if (matches.length > 0) {
    await saveMatchScores(matches);
    console.log('💾 Saved match scores to database');
  }

  return matches;
}
