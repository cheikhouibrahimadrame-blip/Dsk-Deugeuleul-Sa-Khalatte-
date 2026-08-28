# 🤖 AI-Powered Matching Guide

## ✅ What's Done

### Database Schema ✅
- **File**: `packages/db/prisma/schema.prisma`
- **Commit**: [`8dc6fd4`](https://github.com/cheikhouibrahimadrame-blip/Dsk-Deugeuleul-Sa-Khalatte-/commit/8dc6fd4019fbd58b494352165795e7ea8506ee52)
- **Added**:
  - `User.interests` - String array for matching
  - `User.skills` - String array for complementary matching
  - `User.embedding` - JSON for future vector search
  - `Goal.embedding` - JSON for semantic goal matching
  - `MatchScore` - Stores compatibility scores between users
  - `GoalMatch` - Many-to-many goal similarities

### AI Matching Service ✅
- **File**: `packages/integrations/src/ai-matching.ts`
- **Commit**: [`acfbffc`](https://github.com/cheikhouibrahimadrame-blip/Dsk-Deugeuleul-Sa-Khalatte-/commit/acfbffc371019cbc10e1e2ab4d86820a52e74fcb)
- **Functions**:
  - `findMatchesForUser()` - Finds compatible users
  - `saveMatchScores()` - Persists matches to DB
  - `getTopMatchesForUser()` - Retrieves saved matches
  - `createMatchChat()` - Creates chat rooms between matches
  - `runMatchingForUser()` - Main orchestration function

### Matching Worker ✅
- **File**: `apps/worker/src/matching-worker.ts`
- **Commit**: [`dff7ab6`](https://github.com/cheikhouibrahimadrame-blip/Dsk-Deugeuleul-Sa-Khalatte-/commit/dff7ab61ff13a959654ac89ccdf1e663b79e8eca)
- **Features**:
  - Runs matching for all users with active goals
  - Creates chat rooms for top 3 matches per user
  - Logs progress and statistics
  - Error handling and graceful shutdown

---

## 🔧 Setup Steps

### Step 1: Run Database Migration

```bash
cd packages/db
pnpm prisma migrate dev --name add_ai_matching
pnpm prisma generate
```

---

### Step 2: Test Matching Locally

Create a test script `test-matching.ts`:

```typescript
import { prisma } from '@dsk/db';
import { runMatchingForUser } from '@dsk/integrations';

async function test() {
  // Create test users
  const user1 = await prisma.user.create({
    data: {
      email: 'alice@test.com',
      name: 'Alice',
      interests: ['fitness', 'nutrition', 'yoga'],
      skills: ['cooking', 'planning'],
      goals: {
        create: {
          title: 'Lose 10kg',
          description: 'Want to lose weight through healthy eating and exercise',
          category: 'health',
        },
      },
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'bob@test.com',
      name: 'Bob',
      interests: ['fitness', 'running', 'nutrition'],
      skills: ['personal training', 'meal prep'],
      goals: {
        create: {
          title: 'Get fit',
          description: 'Improve fitness through regular exercise and diet',
          category: 'health',
        },
      },
    },
  });

  console.log('Created test users:', user1.id, user2.id);

  // Run matching
  const matches = await runMatchingForUser(user1.id, 5);
  console.log('Matches found:', matches);

  await prisma.$disconnect();
}

test();
```

Run it:
```bash
cd apps/worker
pnpm tsx src/test-matching.ts
```

---

### Step 3: Run Matching Worker

```bash
cd apps/worker
pnpm tsx src/matching-worker.ts
```

You should see output like:
```
🚀 Starting matching worker...
👥 Found 2 users with active goals

🔍 Processing user: Alice
🔍 Finding matches for user abc123...
✅ Found 1 potential matches
💾 Saved match scores to database
  💬 Created chat room: xyz789

✅ Matching worker completed!
⏱️  Duration: 1.23s
📊 Total matches found: 1
💬 Chat rooms created: 1
```

---

### Step 4: Schedule Matching (Production)

Add to your cron system (e.g., GitHub Actions, cron job, etc.):

```yaml
# .github/workflows/matching.yml
name: Run AI Matching

on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight
  workflow_dispatch:

jobs:
  matching:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm tsx apps/worker/src/matching-worker.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 📊 How Matching Works

### Scoring Algorithm

The matching algorithm calculates compatibility based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Goal Similarity** | 50% | Category match + description similarity |
| **Shared Interests** | 30% | Jaccard similarity of interest arrays |
| **Complementary Skills** | 20% | Bonus for non-overlapping skills |

### Text Similarity

Uses **cosine similarity** on word vectors:
- Filters words >3 characters
- Creates binary word presence vectors
- Calculates cosine of angle between vectors

```typescript
// Example: "fitness health" vs "health wellness"
// Words: [fitness, health, wellness]
// Vec1: [1, 1, 0]
// Vec2: [0, 1, 1]
// Similarity: 0.577
```

### Threshold

Only matches with **score >= 0.2** are returned, ensuring quality matches.

---

## 🎯 API Reference

### Find Matches for User

```typescript
import { findMatchesForUser } from '@dsk/integrations';

const matches = await findMatchesForUser('user-id', 10);
// Returns: MatchResult[]
```

### MatchResult Interface

```typescript
interface MatchResult {
  userId: string;
  matchedUserId: string;
  score: number; // 0.0 to 1.0
  reason: string;
  sharedGoals: string[];
  sharedInterests: string[];
  complementarySkills: string[];
}
```

### Create Match Chat

```typescript
import { createMatchChat } from '@dsk/integrations';

const chatRoomId = await createMatchChat(
  'user1-id',
  'user2-id',
  'optional-goal-id'
);
```

---

## 🚀 Frontend Integration

### Display Matches in UI

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/chat';

interface Match {
  matchedUserId: string;
  score: number;
  reason: string;
  sharedInterests: string[];
}

export function MatchesList({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    // Fetch matches from your API
    fetch(`/api/matches?userId=${userId}`)
      .then(res => res.json())
      .then(data => setMatches(data));
  }, [userId]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Recommended Matches</h2>
      
      {matches.map(match => (
        <div key={match.matchedUserId} className="p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Match</h3>
            <span className="text-sm text-green-600">
              {(match.score * 100).toFixed(0)}% compatible
            </span>
          </div>
          
          <p className="text-sm text-gray-600 mt-2">{match.reason}</p>
          
          {match.sharedInterests.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {match.sharedInterests.map(interest => (
                <span
                  key={interest}
                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
          
          <button
            onClick={() => {
              const socket = getSocket();
              socket?.emit('chat:join', { chatRoomId: match.chatRoomId });
            }}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Start Chat
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔐 Privacy & Safety

1. **User Consent**: Only match users who opt-in
2. **Data Minimization**: Only use necessary fields for matching
3. **Block List**: Allow users to block unwanted matches
4. **Report System**: Let users report inappropriate matches

---

## 🚀 Future Enhancements

### 1. Real Embeddings (Production)

Replace simple text similarity with actual embeddings:

```typescript
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Store in User.embedding and Goal.embedding
// Use pgvector for similarity search in PostgreSQL
```

### 2. Collaborative Filtering

```typescript
// Users who interacted with X also liked Y
// Based on chat activity, goal completion, etc.
```

### 3. Activity-Based Matching

```typescript
// Match users with similar activity patterns
// Morning people, weekend warriors, etc.
```

### 4. ML Model

Train a model on successful matches:
- Features: interests, skills, goals, activity
- Label: Did they chat? Did they complete goals together?
- Model: XGBoost, LightGBM, or neural network

---

## 📊 Monitoring

Track these metrics:
- **Match acceptance rate** - % who start chatting
- **Chat engagement** - Messages per matched pair
- **Goal completion** - Do matched users complete more goals?
- **User retention** - Do matched users stay longer?

---

## 🐛 Troubleshooting

### No matches found
- Check user has active goals
- Verify interests/skills are populated
- Lower threshold from 0.2 to 0.1 temporarily

### Slow performance
- Add database indexes on `interests`, `skills`
- Cache match results for 24h
- Run matching asynchronously via worker

### Poor match quality
- Increase weight on goal similarity
- Add more detailed goal descriptions
- Collect user feedback on matches

---

## 📞 Support

If you run into issues:
1. Check worker logs for errors
2. Verify database migration ran successfully
3. Ensure users have goals + interests populated
4. Test with small dataset first

Good luck! 🎉
