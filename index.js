const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = 5000;

// --- CORS Config ---
const corsOptions = {
  origin: ["http://localhost:5173", "https://fulus-topaz.vercel.app", 'https://fulus-admin.vercel.app', 'http://localhost:5174'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// --- MongoDB Setup ---
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t87ip2a.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let usersCollection;
let generationsCollection;
let bonusesCollection;
let withdrawCollection;
let transferCollection;
let depositCollection;
let agentCollection;
let noticeCollection;
let dailyCollection;
let transactionsCollection;
let agentAddmoneyCollection;
let jobsCollection;
let workersCollection;
let buysCollection;
let sellsCollection;
let needHelpsCollection;
let socialhelpsCollection;
let problemsCollection;
let solutionsCollection;


let isConnected = false;

async function connectToMongoDB() {
  try {
    if (!client.topology?.isConnected()) {
      await client.connect();
    }
    const db = client.db("fulus");
    usersCollection = db.collection("users");
    generationsCollection = db.collection("generations");
    bonusesCollection = db.collection("bonuses");
    withdrawCollection = db.collection("withdraws");
    transferCollection = db.collection("transfers");
    depositCollection = db.collection("deposits");
    agentCollection = db.collection("agents");
    noticeCollection = db.collection("notice");
    dailyCollection = db.collection("savings");
    transactionsCollection = db.collection("sendmoney");
    agentAddmoneyCollection= db.collection('addmoneyAgent')
    jobsCollection= db.collection('jobs')
    workersCollection= db.collection('workers')
    buysCollection= db.collection('buys')
    sellsCollection= db.collection('sells')
    needHelpsCollection= db.collection('needhelps')
    socialhelpsCollection= db.collection('socialhelps')
    problemsCollection= db.collection('problems')
    solutionsCollection= db.collection('solutions')


    isConnected = true;
    console.log("✅ MongoDB connected & collection ready.");
  } catch (error) {
    isConnected = false;
    console.error("❌ MongoDB connection failed:", error.message);
  }
}

// Immediately connect to DB
connectToMongoDB();

// --- Routes ---

// Default Route
app.get("/", (req, res) => {
  res.send({ message: "Welcome to Fulus backend!" });
});

app.use((req, res, next) => {
  if (!isConnected) {
    return res.status(503).json({ success: false, message: "DB not connected" });
  }
  next();
});


app.post("/api/users", async (req, res) => {
  try {
    if (!usersCollection || !generationsCollection) {
      return res.status(503).json({ success: false, message: "DB not connected" });
    }

    const {
      name,
      phone,
      password,
      avatarUrl,
      userId,
      transactionId,
      createdAt,
      role,
      balance,
      chargeAmount,
      sponsorId
    } = req.body;

    if (!name || !phone || !password || !avatarUrl || !userId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ✅ Check if user already exists
    const existing = await usersCollection.findOne({ userId: Number(userId) });
    if (existing) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    // ✅ If sponsor exists, check balance
    let sponsor = null;

  if (sponsorId) {
  sponsor = await usersCollection.findOne({ userId: Number(sponsorId) });

  if (!sponsor) {
    return res.status(404).json({ success: false, message: "Sponsor not found" });
  }

  // Remove any balance deduction or update here — no update needed
}

    // ✅ Create new user
    const newUser = {
      name,
      phone,
      password,
      avatarUrl,
      userId: Number(userId),
      transactionId,
      createdAt: createdAt || new Date().toISOString(),
      role: role || "user",
      balance: balance || 0,
      agentBalance:0,
      status:'inactive',
      chargeAmount: 0,
      sponsorId: sponsorId ? Number(sponsorId) : null,
    };

    const result = await usersCollection.insertOne(newUser);

    // ✅ Generation Mapping
    if (sponsorId) {
      const sponsorGen = await generationsCollection.findOne({ userId: Number(sponsorId) });

      const generationData = {
        userId: Number(userId),
        sponsorId: Number(sponsorId),
        g2: sponsorGen?.sponsorId || null,
        g3: sponsorGen?.g2 || null,
        g4: sponsorGen?.g3 || null,
        g5: sponsorGen?.g4 || null,
        g6: sponsorGen?.g5 || null,
        g7: sponsorGen?.g6 || null,
        g8: sponsorGen?.g7 || null,
        g9: sponsorGen?.g8 || null,
        g10: sponsorGen?.g9 || null,
      };

      await generationsCollection.insertOne(generationData);
    }

    const createdUser = await usersCollection.findOne({ _id: result.insertedId });
    res.status(201).json({
      success: true,
      message: "User created Successfully.",
      user: createdUser
    });
  } catch (error) {
    console.error("Create user error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.get("/api/generations/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const maxLevels = 10;
    let currentUserId = userId;
    const generations = {};

    for (let i = 1; i <= maxLevels; i++) {
      const user = await usersCollection.findOne({ userId: currentUserId });
      if (!user || !user.sponsorId) break;

      generations[`g${i}`] = user.sponsorId;
      currentUserId = user.sponsorId;
    }

    res.json({ success: true, generations });
  } catch (error) {
    console.error("Error fetching generations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Get All Users (excluding password)
app.get("/api/users", async (req, res) => {
  try {
    if (!usersCollection) return res.status(503).json({ success: false, message: "DB not connected" });

    const users = await usersCollection.find().toArray();
    const safeUsers = users.map(({ password, ...u }) => u);

    res.status(200).json(safeUsers);
  } catch (error) {
    console.error("Get users error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE user by userId
app.delete("/api/users/:userId", async (req, res) => {
  try {
    if (!usersCollection)
      return res.status(503).json({ success: false, message: "DB not connected" });

    const userId = Number(req.params.userId); // convert to number

    const result = await usersCollection.deleteOne({ userId: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid userId" });

    const user = await usersCollection.findOne({ userId });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { password, ...safeUser } = user;
    res.status(200).json({ success: true, user: safeUser });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/users/:userId/update-profile", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { name, whatsapp, country, address, email } = req.body;

    // Update in database (example with MongoDB)
    const updatedUser = await usersCollection.findOneAndUpdate(
      { userId },
      { $set: { name, phone: whatsapp, country, address, email } },
      { returnDocument: "after" }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/users/:userId/update-password", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { oldPassword, newPassword } = req.body;

    // Find the user first
    const user = await usersCollection.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check old password (plain text match)
    if (user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: "Old password is incorrect" });
    }

    // Update the password
    const updatedUser = await usersCollection.findOneAndUpdate(
      { userId },
      { $set: { password: newPassword } },
      { returnDocument: "after" }
    );

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.get('/api/bonus/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const maxLevels = 10;
    let currentUserId = userId;
    const generations = {};

    for (let i = 1; i <= maxLevels; i++) {
      const user = await usersCollection.findOne({ userId: currentUserId });
      if (!user || !user.sponsorId) break;

      generations[`g${i}`] = user.sponsorId;
      currentUserId = user.sponsorId;
    }

    // Your bonus distribution config
    const bonusSettings = {
      g10: 0, g9: 0, g8: 0, g7: 0, g6: 0,
      g5: 5, g4: 5, g3: 5, g2: 10, g1: 20,
      sponsorid: 20,
      ownid: 0,
    };


    // Calculate bonus per generation present
    const generationBonus = {};
    Object.entries(generations).forEach(([genKey, sponsorId]) => {
      generationBonus[genKey] = bonusSettings[genKey] || 0;
    });

    return res.json({
      success: true,
      userId,
      generations,
      generationBonus,
    });
  } catch (error) {
    console.error('Bonus API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



// Login
app.post("/login", async (req, res) => {
  try {
    if (!usersCollection) return res.status(503).json({ success: false, message: "DB not connected" });

    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ success: false, message: "User ID and password required" });
    }

    const numericUserId = Number(userId);
    if (isNaN(numericUserId)) {
      return res.status(400).json({ success: false, message: "User ID must be a number" });
    }

    const user = await usersCollection.findOne({ userId: numericUserId, password });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        userId: user.userId,
        role: user.role || "user",
        avatarUrl: user.avatarUrl,
        balance: user.balance || 0,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/bonus/daily-income/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: "Invalid userId" });

    // Define daily income bonus config
    const dailyIncomeSettings = {
      sponsorid: 15,
      ownid: 30,
      g2: 12,
      g3: 9,
      g4: 6,
      g5: 3,
      g6: 0,
      g7: 0,
      g8: 0,
      g9: 0,
      g10: 0,
    };

    // Fetch the generations chain for userId
    let currentUserId = userId;
    const generations = {};

    for (let i = 1; i <= 10; i++) {
      const user = await usersCollection.findOne({ userId: currentUserId });
      if (!user) break;

      if (i === 1) {
        generations[`g1`] = currentUserId;
      } else {
        if (!user.sponsorId) break;
        generations[`g${i}`] = user.sponsorId;
        currentUserId = user.sponsorId;
      }
    }

    // Prepare bonuses to distribute
    const bonusesToDistribute = [];

    // Own bonus
    bonusesToDistribute.push({
      userId: userId,
      amount: dailyIncomeSettings.ownid,
      reason: "Own daily income bonus",
    });

    // Sponsor bonus (g1)
    if (generations.g2) {
      bonusesToDistribute.push({
        userId: generations.g2,
        amount: dailyIncomeSettings.sponsorid,
        reason: "Sponsor daily income bonus (g1)",
      });
    }

    // Generations g2 to g10 bonus
    for (let level = 2; level <= 10; level++) {
      const genKey = `g${level + 1}`; // because g2 is sponsor of g1, so offset by 1
      const userAtGen = generations[genKey];
      if (userAtGen && dailyIncomeSettings[`g${level}`] > 0) {
        bonusesToDistribute.push({
          userId: userAtGen,
          amount: dailyIncomeSettings[`g${level}`],
          reason: `Generation ${level} daily income bonus`,
        });
      }
    }

    // Distribute bonuses by updating user balances
    for (const bonus of bonusesToDistribute) {
      await usersCollection.updateOne(
        { userId: bonus.userId },
        { $inc: { balance: bonus.amount } }
      );
    }

    res.json({
      success: true,
      userId,
      generations,
      distributedBonuses: bonusesToDistribute,
    });
  } catch (error) {
    console.error("Daily income bonus distribution error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Recursive function to get referrals tree for a userId
async function getReferralsTreeWithGenAndCount(userId, maxDepth = 10, currentDepth = 1) {
  if (currentDepth > maxDepth) return { referrals: [], count: 0 };

  const referrals = await usersCollection
    .find({ sponsorId: userId })
    .project({ password: 0 })
    .toArray();

  const generationLabel = `gen${currentDepth}`;

  let totalCount = referrals.length;

  const results = await Promise.all(referrals.map(async (ref) => {
    const nested = await getReferralsTreeWithGenAndCount(ref.userId, maxDepth, currentDepth + 1);
    totalCount += nested.count; // add child's count

    return {
      _id: ref._id,
      userId: ref.userId,
      name: ref.name,
      phone: ref.phone,
      avatarUrl: ref.avatarUrl,
      generation: generationLabel,
      referrals: nested.referrals,
    };
  }));

  return { referrals: results, count: totalCount };
}

// ✅ GET /api/bonus/by-generation/:userId
app.get("/api/bonus/by-generation/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const generationBonusSettings = {
      gen1: 0.0133, gen2: 0.0133, gen3: 0.0133, gen4: 0.0133,
      gen5: 0.0133, gen6: 0.0133, gen7: 0.0133, gen8: 0.0133,
      gen9: 0.0133, gen10: 0.0133
    };

    const dailyIncomeSettings = {
      gen1: 0.0798 , gen2: 0.0532, gen3: 0.0266, gen4: 0.0133,
      gen5: 0.0133, gen6: 0.0133, gen7: 0.0133, gen8: 0.0133,
      gen9: 0.0133, gen10: 0.0133
    };

    // New instant bonus (same for all gens)
    const instantBonusValue = 2.5974;

    const bonusesByGeneration = {
      gen1: [], gen2: [], gen3: [], gen4: [],
      gen5: [], gen6: [], gen7: [], gen8: [], gen9: [], gen10: []
    };

    const selfUser = await usersCollection.findOne({ userId });
    if (!selfUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const collectedDocs = await bonusesCollection.find({ userId }).toArray();
    const collectedMap = new Set(
      collectedDocs.map(doc => `${doc.fromUserId}-${doc.generation}`)
    );

    const tree = await getReferralsTreeWithGenAndCount(userId, 10);

    function traverseAndAssign(node) {
      for (const ref of node) {
        const genKey = ref.generation;
        if (bonusesByGeneration[genKey]) {
          bonusesByGeneration[genKey].push({
            userId: ref.userId,
            genBonus: generationBonusSettings[genKey],
            dailyBonus: dailyIncomeSettings[genKey],
            instantBonus: instantBonusValue, // ✅ Added here
            bonusCollect: collectedMap.has(`${ref.userId}-${genKey}`),
          });
        }
        if (ref.referrals && ref.referrals.length > 0) {
          traverseAndAssign(ref.referrals);
        }
      }
    }

    traverseAndAssign(tree.referrals);

    res.json({ success: true, bonusesByGeneration });
  } catch (error) {
    console.error("Bonus by generation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




app.post('/api/bonus/collect', async (req, res) => {
  try {
    let { userId, fromUserId, generation } = req.body;
    if (!userId || !generation || !fromUserId) {
      return res.status(400).json({ success: false, message: "Missing userId, fromUserId or generation" });
    }

    userId = Number(userId);
    fromUserId = Number(fromUserId);

    // Prevent duplicate collection
    const existing = await bonusesCollection.findOne({ userId, fromUserId, generation });
    if (existing?.bonusCollect) {
      return res.status(400).json({ success: false, message: "Bonus already collected" });
    }

    const bonusConfig = {
      dailyBonus: {
        gen1: 0.0798 , gen2: 0.0532, gen3: 0.0266, gen4: 0.0133,
        gen5: 0.0133, gen6: 0.0133, gen7: 0.0133, gen8: 0.0133,
        gen9: 0.0133, gen10: 0.0133,
      },
      generationBonus: {
        gen1: 0.0133, gen2: 0.0133, gen3: 0.0133, gen4: 0.0133,
        gen5: 0.0133, gen6: 0.0133, gen7: 0.0133, gen8: 0.0133,
        gen9: 0.0133, gen10: 0.0133,
      },
      instantBonus: {
        gen1: 2.5974, gen2: 2.5974, gen3: 2.5974, gen4: 2.5974,
        gen5: 2.5974, gen6: 2.5974, gen7: 2.5974, gen8: 2.5974,
        gen9: 2.5974, gen10: 2.5974
      }
    };

    const dailyBonus = bonusConfig.dailyBonus[generation] || 0;
    const genBonus = bonusConfig.generationBonus[generation] || 0;
    const instantBonus = bonusConfig.instantBonus[generation] || 0;

    // Save collected bonus record
    await bonusesCollection.updateOne(
      { userId, fromUserId, generation },
      {
        $set: {
          bonusCollect: true,
          collectedAt: new Date(),
          dailyBonus,
          genBonus,
          instantBonus
        }
      },
      { upsert: true }
    );

    // Count members for user stats
    const memberCount = await usersCollection.countDocuments({ sponsorId: userId });

    // Update user's earnings & total collected stats
    const updateResult = await usersCollection.findOneAndUpdate(
      { userId },
      {
        $inc: {
          goldBalance: dailyBonus + genBonus + instantBonus, // ✅ Added instant bonus
          generationBonus: genBonus,
          dailyIncome: dailyBonus,
          totalGenerationBonusCollected: genBonus,
          totalInstantBonusCollected: instantBonus // ✅ New stat
        },
        $set: {
          memberCount: memberCount
        }
      },
      { returnDocument: "after" }
    );

    const updatedUser = updateResult?.value || {};

    res.json({
      success: true,
      message: "Bonus collected successfully",
      totalGenerationBonusCollected: updatedUser.totalGenerationBonusCollected || 0,
      totalInstantBonusCollected: updatedUser.totalInstantBonusCollected || 0,
      currentBalance: updatedUser.goldBalance || 0
    });

  } catch (error) {
    console.error("Error collecting bonus:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.get('/api/users/:userId/referrals', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const { referrals, count } = await getReferralsTreeWithGenAndCount(userId);

    res.json({
      success: true,
      userId,
      totalReferrals: count,
      referrals,
    });
  } catch (error) {
    console.error("Error fetching referral tree:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Count all nested referrals for a single user
function countAllNestedReferrals(user) {
  if (!user.referrals || user.referrals.length === 0) return 0;
  let count = user.referrals.length;
  for (const ref of user.referrals) {
    count += countAllNestedReferrals(ref);
  }
  return count;
}

app.get("/api/users/:userId/gen1-ref-totals", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { referrals } = await getReferralsTreeWithGenAndCount(userId);

    // Filter only Gen1
    const gen1 = referrals.filter(r => r.generation === "gen1");

    const gen1Data = gen1.map(g1 => ({
      userId: g1.userId,
      name: g1.name,
      phone: g1.phone,
      totalReferrals: countAllNestedReferrals(g1)
    }));

    res.json({ success: true, userId, gen1Data });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Recursive helper function to count ALL referrals under a user (all generations)
async function countAllReferrals(userId, usersCollection) {
  // Find direct referrals of this user
  const directRefs = await usersCollection.find({ sponsorId: userId }).project({ userId: 1 }).toArray();

  if (directRefs.length === 0) return 0;

  // Count direct referrals
  let total = directRefs.length;

  // Recursively count referrals of each direct referral
  for (const ref of directRefs) {
    total += await countAllReferrals(ref.userId, usersCollection);
  }

  return total;
}

app.get("/api/users/:userId/team-summary", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Fetch all users once (avoid multiple DB hits)
    const allUsers = await usersCollection.find().project({ password: 0 }).toArray();

    // --- Step 1: Build a lookup map for faster referral tree search
    const referralMap = new Map();
    allUsers.forEach(u => {
      if (!referralMap.has(u.sponsorId)) referralMap.set(u.sponsorId, []);
      referralMap.get(u.sponsorId).push(u);
    });

    // --- Step 2: Get Gen1 users (direct referrals)
    const gen1Users = referralMap.get(userId) || [];
    const totalGen1 = gen1Users.length;

    // --- Step 3: BFS to calculate team
    function countNestedReferrals(rootUserId) {
      const queue = [...(referralMap.get(rootUserId) || [])];
      const visited = new Set();
      while (queue.length) {
        const current = queue.shift();
        if (!visited.has(current.userId)) {
          visited.add(current.userId);
          queue.push(...(referralMap.get(current.userId) || []));
        }
      }
      return visited.size;
    }

    // Compute Gen1 details + total team
    let totalTeam = 0;
    const gen1Details = gen1Users.map(g1 => {
      const nestedCount = countNestedReferrals(g1.userId);
      totalTeam += nestedCount;
      return {
        userId: g1.userId,
        name: g1.name,
        phone: g1.phone,
        totalReferrals: nestedCount
      };
    });

    // --- Step 4: Compute rank of current user
    const referralCounts = allUsers.map(u => {
      return {
        userId: u.userId,
        totalReferrals: countNestedReferrals(u.userId)
      };
    }).sort((a, b) => b.totalReferrals - a.totalReferrals);

    const rankIndex = referralCounts.findIndex(u => u.userId === userId);
    const userRank = rankIndex >= 0 ? rankIndex + 1 : null;
    const userReferralCount = referralCounts[rankIndex]?.totalReferrals || 0;

    // --- Final combined response
    res.json({
      success: true,
      userId,
      totalGen1,
      totalTeam,
      rank: userRank,
      totalReferrals: userReferralCount,
      gen1Details
    });

  } catch (error) {
    console.error("Error fetching team summary:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get('/api/users/:userId/rank', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const users = await usersCollection.find().toArray();

    // Calculate referral counts for all users (could be optimized)
    const referralData = [];

    for (const user of users) {
      if (!user.userId || typeof user.userId !== 'number') continue;

      const { count } = await getReferralsTreeWithGenAndCount(user.userId);
      referralData.push({
        userId: user.userId,
        totalReferrals: count,
      });
    }

    // Sort descending by referral count
    referralData.sort((a, b) => b.totalReferrals - a.totalReferrals);

    // Find rank of requested userId
    const rankIndex = referralData.findIndex(u => u.userId === userId);

    if (rankIndex === -1) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userRank = rankIndex + 1;
    const userReferralCount = referralData[rankIndex].totalReferrals;

    res.json({
      success: true,
      userId,
      rank: userRank,
      totalReferrals: userReferralCount,
    });
  } catch (error) {
    console.error("Error fetching user rank:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// Utility function to sanitize keys for MongoDB (replace dots and dashes with underscores)
const sanitizeKey = (str) => str.replace(/\./g, '_').replace(/-/g, '_');

app.post('/api/users/collect-reward', async (req, res) => {
  try {
    let { userId, rank, goldAmount = 0, sarAmount = 0 } = req.body;

    if (!userId || !rank) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const userIdNum = Number(userId);
    if (isNaN(userIdNum)) {
      return res.status(400).json({ success: false, message: "Invalid userId." });
    }

    goldAmount = Number(goldAmount) || 0;
    sarAmount = Number(sarAmount) || 0;

    const collectedKey = `${sanitizeKey(rank)}_all`;

    const user = await usersCollection.findOne({ userId: userIdNum });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Check if reward already collected
    if (user.rankBonus && user.rankBonus[collectedKey]) {
      return res.status(400).json({ success: false, message: "Reward already collected." });
    }

    // Atomic update - increment balances and set reward collection key only if not exists
    const updateResult = await usersCollection.updateOne(
      { userId: userIdNum, [`rankBonus.${collectedKey}`]: { $exists: false } },
      {
        $inc: { balance: sarAmount, goldBalance: goldAmount },
        $set: { [`rankBonus.${collectedKey}`]: { sar: sarAmount, gold: goldAmount, collectedAt: new Date() } },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ success: false, message: "Reward already collected or update failed." });
    }

    return res.json({ success: true, message: "SAR + Gold reward collected successfully." });
  } catch (error) {
    console.error('Collect reward error:', error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

app.get('/api/users/:userId/bonus-status', async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  try {
    const user = await usersCollection.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log('Returning rankBonus:', user.rankBonus);

    return res.json({
      success: true,
      rankBonus: user.rankBonus || {},
    });
  } catch (err) {
    console.error("Error fetching bonus status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.get('/api/admin/referral-report', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();

    const referralStats = await Promise.all(
      users.map(async ({ password, ...user }) => {
        const { count } = await getReferralsTreeWithGenAndCount(user.userId);
        return {
          ...user,
          totalReferrals: count,
        };
      })
    );

    res.json({ success: true, users: referralStats });
  } catch (error) {
    console.error("Error generating referral report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Rank all users by their total referral tree size (multi-generation)
app.get('/api/admin/users-with-rank', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();

    const referralData = [];

    for (const user of users) {
      // Validate userId exists and is valid number
      if (!user.userId || typeof user.userId !== 'number') {
        console.warn('Skipping user with invalid userId:', user);
        continue;
      }

      try {
        // Assuming your existing recursive function is available
        const { count } = await getReferralsTreeWithGenAndCount(user.userId);

        referralData.push({
          userId: user.userId,
          name: user.name,
          phone: user.phone,
          totalReferrals: count,
        });
      } catch (err) {
        console.error(`Failed to count referrals for userId ${user.userId}:`, err.message);
      }
    }

    // Sort descending by totalReferrals
    referralData.sort((a, b) => b.totalReferrals - a.totalReferrals);

    // Assign rank based on position in sorted array
    const rankedUsers = referralData.map((user, idx) => ({
      ...user,
      rank: idx + 1,
    }));

    res.json({ success: true, users: rankedUsers });
  } catch (error) {
    console.error('Error fetching users with ranks:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



app.post('/api/withdraw', async (req, res) => {
  try {
    const { userId, method, amount, accountNumber, pin } = req.body;

    const numericUserId = Number(userId);
    const withdrawAmount = Number(amount);
    const numericPin = Number(pin);

    if (!numericUserId || !withdrawAmount || withdrawAmount <= 0 || !numericPin) {
      return res.json({ success: false, message: 'Invalid withdraw request' });
    }

    const user = await usersCollection.findOne({ userId: numericUserId });
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // ✅ Check transaction PIN (number match)
    if (!user.transactionPin || user.transactionPin !== numericPin) {
      return res.json({ success: false, message: 'Invalid transaction PIN' });
    }

    const totalBalance = user.balance || 0;

    // ✅ Calculate 5% charge
    const chargePercent = 5;
    const chargeAmount = (withdrawAmount * chargePercent) / 100;
    const totalDeduction = withdrawAmount + chargeAmount; // user balance থেকে কাটা হবে

    if (totalBalance < totalDeduction) {
      return res.json({ success: false, message: 'Insufficient balance including 5% charge' });
    }

    // Deduct total (amount + charge)
    const newBalance = totalBalance - totalDeduction;

    // Update user balance
    const updateResult = await usersCollection.updateOne(
      { userId: numericUserId },
      { $set: { balance: newBalance } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.json({ success: false, message: 'Failed to update user balances' });
    }

    // Insert withdraw request
    await withdrawCollection.insertOne({
      userId: numericUserId,
      method,
      requestedAmount: withdrawAmount, // user চেয়েছে
      charge: chargeAmount,            // ৫% charge
      finalAmount: withdrawAmount,     // user পাবে
      totalDeducted: totalDeduction,   // balance থেকে কাটা হয়েছে
      accountNumber,
      status: 'Pending',
      createdAt: new Date(),
    });

    return res.json({ 
      success: true, 
      message: `Withdraw request submitted successfully. 5% charge = ${chargeAmount} SAR` 
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    return res.json({ success: false, message: 'Internal server error' });
  }
});


app.get('/api/withdraw', async (req, res) => {
  try {
    const withdraws = await withdrawCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data: withdraws });
  } catch (error) {
    console.error('Withdraw fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.get("/api/withdraw/pending", async (req, res) => {
  try {
    const withdraws = await withdrawCollection.find({ status: "Pending" }).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, withdraws });
  } catch (error) {
    console.error("Failed to fetch pending withdraws:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Agent accepts a withdraw request (status Pending => Processing)
app.put("/api/withdraw/accept/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { agentUserId } = req.body;

    if (!agentUserId) {
      return res.status(400).json({ success: false, message: "Agent userId is required" });
    }

    const withdraw = await withdrawCollection.findOne({ _id: new ObjectId(id) });
    if (!withdraw) return res.status(404).json({ success: false, message: "Withdraw request not found" });
    if (withdraw.status !== "Pending") return res.status(400).json({ success: false, message: "Withdraw already processed" });

    const agent = await usersCollection.findOne({ userId: agentUserId });
    if (!agent) return res.status(404).json({ success: false, message: "Agent not found" });

    // ✅ Remove balance check here — let agent accept regardless of balance

    await withdrawCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "Processing",
          agentId: agentUserId,
          acceptedAt: new Date(),
        }
      }
    );

    res.json({ success: true, message: "Withdraw request accepted by agent" });
  } catch (error) {
    console.error("Failed to accept withdraw:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Mark withdraw success (Processing => Success) and pay agent commission
app.put("/api/withdraw/success/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { agentUserId } = req.body;

    if (!agentUserId) {
      return res.status(400).json({ success: false, message: "Agent userId is required" });
    }

    const withdraw = await withdrawCollection.findOne({ _id: new ObjectId(id) });
    if (!withdraw) return res.status(404).json({ success: false, message: "Withdraw request not found" });
    if (withdraw.status !== "Processing") return res.status(400).json({ success: false, message: "Withdraw is not in processing state" });

    const agent = await usersCollection.findOne({ userId: agentUserId });
    if (!agent) return res.status(404).json({ success: false, message: "Agent not found" });

    const commission = parseFloat((withdraw.finalAmount * 0.05).toFixed(2));
    const totalEarned = withdraw.finalAmount + commission;

    // ✅ Add withdraw amount + commission to agent's balance
    await usersCollection.updateOne(
      { userId: agentUserId },
      {
        $inc: {
          agentBalance: totalEarned,
        }
      }
    );

    // Update withdraw status to success
    await withdrawCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "Success",
          completedAt: new Date(),
          commission,
        }
      }
    );

    res.json({ success: true, message: `Withdraw completed successfully. Agent earned ${commission} SAR commission.` });
  } catch (error) {
    console.error("Failed to complete withdraw success:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.post('/api/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;

    if (!fromUserId || !toUserId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    const fromUser = await usersCollection.findOne({ userId: parseInt(fromUserId) });
    const toUser = await usersCollection.findOne({ userId: parseInt(toUserId) });

    if (!fromUser || !toUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (fromUser.agentBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Perform the balance transfer
    await usersCollection.updateOne(
      { userId: fromUser.userId },
      { $inc: { agentBalance: -amount } }
    );

    await usersCollection.updateOne(
      { userId: toUser.userId },
      { $inc: { balance: amount } }
    );

    // Optional: Record the transfer
    await transferCollection.insertOne({
      fromUserId: fromUser.userId,
      toUserId: toUser.userId,
      amount,
      createdAt: new Date(),
    });

    res.json({ success: true, message: 'Transfer successful' });

  } catch (err) {
    console.error("Transfer error:", err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.post('/api/deposit', async (req, res) => {
  try {
    const { userId, amount, contact } = req.body;

    if (!userId || !amount || !contact) {
      return res.json({ success: false, message: 'All fields are required!' });
    }

    const depositData = {
      userId: Number(userId),
      amount: Number(amount),
      contact, // store contact
      status: 'pending',
      createdAt: new Date()
    };

    const result = await depositCollection.insertOne(depositData);

    res.json({
      success: true,
      message: 'Deposit request received!',
      depositId: result.insertedId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.get("/api/deposit", async (req, res) => {
  const deposits = await depositCollection.find().toArray();
  res.json({ deposits });
});

app.get("/api/deposit/pending", async (req, res) => {
  try {
    // Find deposits with status 'pending'
    const deposits = await depositCollection.find({ status: "pending" }).toArray();
    res.json({ success: true, deposits });
  } catch (error) {
    console.error("Failed to fetch pending deposits:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/deposit/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { acceptedBy } = req.body;

    const result = await depositCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "accepted",
          acceptedBy,
          acceptedAt: new Date(),
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Deposit not found" });
    }

    res.json({ success: true, message: "Deposit accepted successfully" });
  } catch (error) {
    console.error("Failed to accept deposit:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/deposit/success/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    const deposit = await depositCollection.findOne({ _id: new ObjectId(id) });
    if (!deposit) return res.status(404).json({ success: false, message: "Deposit not found" });
    if (deposit.status !== "accepted") return res.status(400).json({ success: false, message: "Deposit not accepted yet" });

    const agent = await usersCollection.findOne({ userId: agentId });
    const depositUser = await usersCollection.findOne({ userId: deposit.userId });

    if (!agent || !depositUser) return res.status(404).json({ success: false, message: "Users not found" });
    if (agent.agentBalance < deposit.amount) return res.status(400).json({ success: false, message: "Insufficient balance" });

    const amount = deposit.amount;
    const commission = parseFloat((amount * 0.02).toFixed(2)); // 2% commission

    // 1️⃣ Deduct full amount from agent
    await usersCollection.updateOne(
      { userId: agentId },
      { $inc: { agentBalance: -amount } }
    );

    // 2️⃣ Add full amount to user
    await usersCollection.updateOne(
      { userId: deposit.userId },
      { $inc: { balance: amount } }
    );

    // 3️⃣ Add 2% commission back to agent
    await usersCollection.updateOne(
      { userId: agentId },
      { $inc: { agentBalance: commission } }
    );

    // 4️⃣ Mark deposit as success
    await depositCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "success",
          successAt: new Date(),
          commission
        }
      }
    );

    res.json({
      success: true,
      message: `Deposit completed. Agent earned ${commission} SAR commission.`
    });

  } catch (error) {
    console.error("Failed to process success:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/deposit/accepted-by/:userId", async (req, res) => {
  try {
    let { userId } = req.params;
    // convert to number if it looks numeric
    userId = /^\d+$/.test(userId) ? Number(userId) : userId;

    const deposits = await depositCollection.find({
      status: "accepted",
      "acceptedBy.userId": userId,
    }).toArray();

    res.json({ success: true, deposits });
  } catch (error) {
    console.error("Failed to fetch accepted deposits by user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




app.patch("/api/deposit/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;

    const result = await depositCollection.updateOne(
      { _id: new ObjectId(id) }, // Convert string to ObjectId
      { $set: { status } }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Deposit not found or status unchanged" });
    }
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
app.get('/api/deposit/pending/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    // Find deposits for user with status 'pending'
    const pendingDeposits = await depositCollection
      .find({ userId: userId, status: 'pending' })
      .toArray();

    res.json({ success: true, pending: pendingDeposits });
  } catch (error) {
    console.error('Error fetching pending deposits:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.get('/api/agent/requests/:userId', async (req, res) => {
  const userId = req.params.userId;

  // Get agent (user)
  const agent = await usersCollection.findOne({ userId });
  if (!agent) return res.status(404).json({ success: false, message: 'User not found' });

  // Check if user already has an accepted request
  const activeRequest = await depositCollection.findOne({
    acceptedBy: userId,
    status: 'accepted',
  });

  if (activeRequest) {
    return res.json({
      success: true,
      requests: [],
      message: 'You already have an active request and cannot accept new ones',
    });
  }

  // Fetch all pending requests (not your own) <= your balance
  const requests = await depositCollection
    .find({
      status: 'pending',
      userId: { $ne: userId }, // exclude your own deposits
      amount: { $lte: agent.balance },
    })
    .toArray();

  res.json({ success: true, requests });
});




// Create or Update agent info (POST)
app.post('/api/agent-info', async (req, res) => {
  try {
    const { name, number } = req.body;
    if (!name || !number) {
      return res.status(400).json({ success: false, message: "Name and number are required" });
    }

    // Upsert: update if exists, else insert
    const result = await agentCollection.updateOne(
      {},
      { $set: { name, number } },
      { upsert: true }
    );

    res.json({ success: true, message: "Agent info saved" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// Get agent info
app.get('/api/agent-info', async (req, res) => {
  try {
    const agent = await agentCollection.findOne({});
    if (!agent) {
      return res.json({
        success: false,
        message: "Agent info not found",
      });
    }
    res.json({ success: true, agent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Create or update notice
app.post('/api/notice', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: "Notice content is required" });

    const result = await noticeCollection.updateOne(
      {},
      { $set: { content } },
      { upsert: true }
    );

    res.json({ success: true, message: 'Notice saved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Get current notice
app.get('/api/notice', async (req, res) => {
  try {
    const notice = await noticeCollection.findOne({});
    res.json({ success: true, notice: notice?.content || "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get transactions by userId
app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    // Fetch deposits
    const deposits = await depositCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch withdraws (assuming legacy or other withdrawCollection)
    const withdraws = await withdrawCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch new types of transactions
    const transactions = await transactionsCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Tag types accordingly
    const formattedDeposits = deposits.map(t => ({ ...t, type: 'deposit' }));
    const formattedWithdraws = withdraws.map(t => ({ ...t, type: 'withdraw' }));
    const formattedTransactions = transactions.map(t => ({
      ...t,
      type: t.type || 'transaction' // e.g. 'send', 'receive', 'withdraw_sar'
    }));

    // Combine all and sort by date descending
    const allTransactions = [...formattedDeposits, ...formattedWithdraws, ...formattedTransactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, transactions: allTransactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.post("/api/daily-savings/collect", async (req, res) => {
  let { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.json({ success: false, message: "Missing userId or amount" });
  }

  userId = Number(userId); // Convert to number for DB

  const today = new Date().toISOString().split("T")[0];

  // Check if already collected today
  const collectedToday = await dailyCollection.findOne({ userId, date: today });
  if (collectedToday) {
    return res.json({ success: false, message: "Already collected today" });
  }

  await dailyCollection.insertOne({ userId, amount, date: today });

  res.json({ success: true });
});

app.get("/api/daily-savings/:userId", async (req, res) => {
  try {
    let { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    userId = Number(userId); // Convert to number for DB
    const allCollections = await dailyCollection.find({ userId }).toArray();

    res.json({ success: true, data: allCollections });
  } catch (error) {
    console.error("Error fetching all daily savings:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.post("/api/generation/collect", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing userId" });
    }

    const userIdNum = Number(userId);

    // Check if today is Friday
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay(); // 0=Sun, 5=Fri
    if (dayOfWeek !== 5) {
      return res.json({
        success: false,
        message: "Collection allowed only on Fridays",
      });
    }

    const todayStr = todayDate.toISOString().split("T")[0];

    // Find user
    const user = await usersCollection.findOne({ userId: userIdNum });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Check if already collected today
    if (user.lastGoldCollect === todayStr) {
      return res.json({
        success: false,
        message: "Already collected today",
      });
    }

    const goldIncrement = (user?.goldBalance || 0) * 0.75;
    // Update user's gold balance and last collection date
    await usersCollection.updateOne(
      { userId: userIdNum },
      {
        $inc: { goldBalance: goldIncrement },        // Add 1.5 grams of gold
        $set: { lastGoldCollect: todayStr } // Save the date to prevent duplicate
      }
    );

    res.json({
      success: true,
      message: "Collected gold added to your account!",
    });
  } catch (error) {
    console.error("Error collecting gold:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.post("/api/daily-income/collect", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    const userIdNum = Number(userId);
    const todayStr = new Date().toISOString().split("T")[0];

    // Find user
    const user = await usersCollection.findOne({ userId: userIdNum });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Check if already collected today
    if (user.lastDailyGoldCollect === todayStr) {
      return res.json({ success: false, message: "Already collected today" });
    }

    // Update user's gold balance & last collect date
    await usersCollection.updateOne(
      { userId: userIdNum },
      {
        $inc: { goldBalance: 0.0213 },          // Add 1.5g gold
        $set: { lastDailyGoldCollect: todayStr } // Track daily collection
      }
    );

    res.json({ success: true, message: "0.0213 g gold added to your account!" });
  } catch (error) {
    console.error("Error collecting daily gold income:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Withdraw Savings API
app.post("/api/savings/withdraw", async (req, res) => {
  try {
    const { userId, withdrawAmount } = req.body;

    if (!userId || !withdrawAmount) {
      return res.json({ success: false, message: "Missing data" });
    }

    const today = new Date();
    if (today.getDate() !== 1) {
      return res.json({ success: false, message: "You can only withdraw on the 1st day of the month" });
    }

    // Fetch all savings for this user
    const savingsData = await dailyCollection.find({
      userId: { $in: [String(userId), Number(userId)] }
    }).toArray();

    if (!savingsData || savingsData.length === 0) {
      return res.json({ success: false, message: "No savings available" });
    }

    // Calculate total, withdraw 75%, leave 25%
    const totalSavings = savingsData.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const withdrawAmt = totalSavings * 0.75;
    const remainAmt = totalSavings * 0.25;

    // Update user balance
    await usersCollection.updateOne(
      { userId: { $in: [String(userId), Number(userId)] } },
      { $inc: { balance: withdrawAmt } }
    );

    // Reset savings collection
    await dailyCollection.deleteMany({ userId: { $in: [String(userId), Number(userId)] } });

    // Insert remaining 25% as last month's date to prevent recollection today
    if (remainAmt > 0) {
      const lastMonth = new Date(today.setMonth(today.getMonth() - 1))
        .toISOString()
        .split("T")[0];

      await dailyCollection.insertOne({
        userId: Number(userId),
        amount: remainAmt,
        date: lastMonth, // not today
      });
    }

    return res.json({
      success: true,
      withdrawn: withdrawAmt,
      remaining: remainAmt
    });

  } catch (err) {
    console.error("Error in withdraw:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// Reward formulas (Gen1 top 3 referrals required for each rank)
const rewardFormulas = [
  { id: 0, label: "V.i.p", formula: [1, 1, 1], total: 3 },
  { id: 1, label: "1★", formula: [3, 3, 3], total: 9 },
  { id: 2, label: "2★", formula: [10, 10, 10], total: 30 },
  { id: 3, label: "3★", formula: [30, 30, 30], total: 90 },
  { id: 4, label: "4★", formula: [85, 85, 85], total: 255 },
  { id: 5, label: "5★", formula: [730, 730, 730], total: 2190 },
  { id: 6, label: "6★", formula: [6600, 6600, 6600], total: 19800 },
  { id: 7, label: "7★", formula: [60000, 60000, 60000], total: 180000 },
];

// Recursive function to count all nested referrals
async function countAllReferrals(userId, usersCollection) {
  const directRefs = await usersCollection.find({ sponsorId: userId }).toArray();
  let total = directRefs.length;

  for (const ref of directRefs) {
    total += await countAllReferrals(ref.userId, usersCollection);
  }
  return total;
}

// API Endpoint
app.get("/api/users/:userId/rank-rewards", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Step 1: Get Gen1 users (direct referrals)
    const gen1Users = await usersCollection.find({ sponsorId: userId }).toArray();

    // Step 2: Calculate total nested referrals for each Gen1 user
    const gen1Data = [];
    for (const gen1 of gen1Users) {
      const totalNestedRefs = await countAllReferrals(gen1.userId, usersCollection);
      gen1Data.push({
        userId: gen1.userId,
        name: gen1.name,
        phone: gen1.phone,
        totalReferrals: totalNestedRefs,
      });
    }

    // Sort descending by totalReferrals
    const sortedRefs = gen1Data
      .map(u => u.totalReferrals)
      .sort((a, b) => b - a);

    // Step 3: Calculate reward progress for each rank
    const rewardsStatus = rewardFormulas.map(rank => {
      const formula = rank.formula;
      const refs = [...sortedRefs];

      // Fill missing gen1 with 0 if user has less than formula length gen1
      while (refs.length < formula.length) refs.push(0);

      let totalPercent = 0;
      let complete = true;

      formula.forEach((req, idx) => {
        const actual = refs[idx] || 0;
        const progress = Math.min(actual / req, 1); // partial progress capped at 1
        totalPercent += progress;
        if (actual < req) complete = false;
      });

      const percent = Math.floor((totalPercent / formula.length) * 100);

      return {
        id: rank.id,
        label: rank.label,
        formula: formula.join(" + "),
        total: rank.total,
        percent,
        complete,
      };
    });

    res.json({
      success: true,
      userId,
      gen1Count: gen1Users.length,
      gen1Details: gen1Data,
      rewardsStatus,
    });
  } catch (error) {
    console.error("Error fetching rank rewards:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.post("/api/users/update-pin", async (req, res) => {
  try {
    const { userId, pin, password } = req.body;

    // Convert userId and pin to Number
    const numericUserId = Number(userId);
    const numericPin = Number(pin);

    if (!numericUserId || !numericPin) {
      return res.json({ success: false, message: "Invalid user or PIN" });
    }

    const user = await usersCollection.findOne({ userId: numericUserId });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.password !== password) {
      return res.json({ success: false, message: "Invalid password" });
    }

    await usersCollection.updateOne(
      { userId: numericUserId },
      { $set: { transactionPin: numericPin } } // ✅ number হিসেবে save
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Server error" });
  }
});


app.post('/api/send-money', async (req, res) => {
  try {
    const { senderId, receiverId, amount, pin } = req.body;
    const sendAmount = Number(amount);

    if (!senderId || !receiverId || !sendAmount || sendAmount <= 0 || !pin) {
      return res.json({ success: false, message: 'Invalid request' });
    }

    const sender = await usersCollection.findOne({ userId: Number(senderId) });
    const receiver = await usersCollection.findOne({ userId: Number(receiverId) });

    if (!sender || !receiver) {
      return res.json({ success: false, message: 'Sender or receiver not found' });
    }

    // Check PIN
    if (!sender.transactionPin || sender.transactionPin !== Number(pin)) {
      return res.json({ success: false, message: 'Invalid Transaction PIN' });
    }

    // Calculate total deduction (1% charge)
    const charge = sendAmount * 0.01;
    const totalDeduction = sendAmount + charge;

    if ((sender.balance || 0) < totalDeduction) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }

    // Update balances
    await usersCollection.updateOne(
      { userId: Number(senderId) },
      { $inc: { balance: -totalDeduction } }
    );
    await usersCollection.updateOne(
      { userId: Number(receiverId) },
      { $inc: { balance: sendAmount } }
    );

    // Insert transaction logs
    await transactionsCollection.insertMany([
      {
        userId: Number(senderId),
        type: 'send',
        amount: sendAmount,
        fee: charge,
        status: 'Completed',
        createdAt: new Date(),
      },
      {
        userId: Number(receiverId),
        type: 'receive',
        amount: sendAmount,
        status: 'Completed',
        createdAt: new Date(),
      },
    ]);

    return res.json({ success: true, message: `Sent ${sendAmount} SAR successfully with 1% charge` });
  } catch (error) {
    console.error('Send money error:', error);
    return res.json({ success: false, message: 'Internal server error' });
  }
});


app.post('/api/withdraw-sar', async (req, res) => {
  try {
    const { userId, amount, pin } = req.body;
    const withdrawAmount = Number(amount);

    if (!userId || !withdrawAmount || withdrawAmount <= 0 || !pin) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }

    const user = await usersCollection.findOne({ userId: Number(userId) });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.transactionPin || user.transactionPin !== Number(pin)) {
      return res.status(401).json({ success: false, message: 'Invalid Transaction PIN' });
    }

    const pricePerGram = 375.855;
    const goldRequired = parseFloat((withdrawAmount / pricePerGram).toFixed(3));

    if ((user.goldBalance || 0) < goldRequired) {
      return res.status(400).json({ success: false, message: 'Not enough gold balance' });
    }

    await usersCollection.updateOne(
      { userId: Number(userId) },
      { $inc: { goldBalance: -goldRequired, balance: withdrawAmount } }
    );

    await transactionsCollection.insertOne({
      userId: Number(userId),
      type: 'withdraw_sar',
      amount: withdrawAmount,
      goldUsed: goldRequired,
      status: 'Completed',
      createdAt: new Date(),
    });

    return res.json({
      success: true,
      message: `Withdraw request of ${withdrawAmount} SAR submitted! Gold used: ${goldRequired}g`,
      newGoldBalance: (user.goldBalance - goldRequired).toFixed(3)
    });

  } catch (error) {
    console.error('SAR Withdraw Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.post('/api/withdraw-gold', async (req, res) => {
  try {
    const { userId, gram, pin, address, contact } = req.body;
    const goldAmount = Number(gram);

    if (!userId || !goldAmount || goldAmount <= 0 || !pin || !address || !contact) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }

    const user = await usersCollection.findOne({ userId: Number(userId) });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Verify transaction PIN
    if (!user.transactionPin || user.transactionPin !== Number(pin)) {
      return res.status(401).json({ success: false, message: 'Invalid Transaction PIN' });
    }

    const availableGold = user.goldBalance || 0;
    if (availableGold < goldAmount) {
      return res.status(400).json({ success: false, message: 'Not enough gold balance' });
    }

    // Deduct gold
    await usersCollection.updateOne(
      { userId: Number(userId) },
      { $inc: { goldBalance: -goldAmount } }
    );

    // Insert transaction log as Pending
    await transactionsCollection.insertOne({
      userId: Number(userId),
      type: 'withdraw_gold',
      goldAmount,
      deliveryAddress: address,
      contact,
      status: 'Pending',
      createdAt: new Date(),
    });

    return res.json({
      success: true,
      message: `Gold withdraw request of ${goldAmount}g submitted successfully!`,
      newGoldBalance: (availableGold - goldAmount).toFixed(3)
    });

  } catch (error) {
    console.error('Gold Withdraw Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/agentAddMoney', async (req, res) => {
  try {
    const { agentId, amount, whatsApp, pin } = req.body;

    // 🔍 Validate required fields
    if (!agentId || !amount || !whatsApp || pin === undefined) {
      return res.json({
        success: false,
        message: 'All fields are required: agentId, amount, whatsApp, pin'
      });
    }

    // 🔍 Find the agent from usersCollection
    const agent = await usersCollection.findOne({ userId: Number(agentId) });

    if (!agent) {
      return res.json({
        success: false,
        message: 'Agent not found!'
      });
    }

    // 🔐 Validate transaction pin (convert both to Number)
    const storedPin = Number(agent.transactionPin);
    const providedPin = Number(pin);

    if (storedPin !== providedPin) {
      return res.json({
        success: false,
        message: 'Invalid transaction PIN!'
      });
    }

    // 💾 Prepare data for insert
    const addMoneyData = {
      agentId: Number(agentId),
      amount: Number(amount),
      whatsApp,
      status: 'pending', // You can later approve this
      createdAt: new Date()
    };

    // 💾 Insert to agentAddmoneyCollection
    const result = await agentAddmoneyCollection.insertOne(addMoneyData);

    res.json({
      success: true,
      message: 'Money add request submitted successfully!',
      requestId: result.insertedId
    });

  } catch (error) {
    console.error('agentAddMoney error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});


app.post("/api/activate-account", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or amount",
      });
    }

    const userIdNum = Number(userId);

    // Find the user
    const user = await usersCollection.findOne({ userId: userIdNum });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if ((user.balance || 0) < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Deduct amount and update status
    const newBalance = (user.balance || 0) - amount;

    await usersCollection.updateOne(
      { userId: userIdNum },
      {
        $set: { status: "active" },
        $inc: { balance: -amount },
      }
    );

    return res.json({
      success: true,
      message: "Account activated successfully",
      newBalance,
      status: "success",
    });
  } catch (error) {
    console.error("Error activating account:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.post('/api/add-bonus', async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const userIdNum = Number(userId);

    // Atomically add bonus amount to user balance
    const updateResult = await usersCollection.updateOne(
      { userId: userIdNum },
      { $inc: { balance: amount } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found or no update performed' });
    }

    // Fetch updated user data
    const updatedUser = await usersCollection.findOne({ userId: userIdNum });

    return res.json({ success: true, balance: updatedUser.balance });
  } catch (err) {
    console.error('Error adding bonus:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post("/api/users/activate", async (req, res) => {
  try {
    const { sponsorUserId, userIdToActivate } = req.body;

    if (!sponsorUserId || !userIdToActivate) {
      return res.status(400).json({
        success: false,
        message: "Missing sponsorUserId or userIdToActivate",
      });
    }

    const sponsorIdNum = Number(sponsorUserId);
    const activateIdNum = Number(userIdToActivate);

    // Fetch sponsor (the one who pays)
    const sponsor = await usersCollection.findOne({ userId: sponsorIdNum });
    if (!sponsor) {
      return res.status(404).json({
        success: false,
        message: "Sponsor user not found",
      });
    }

    if ((sponsor.balance || 0) < 599) {
      return res.status(400).json({
        success: false,
        message: "Sponsor has insufficient balance",
      });
    }

    // Fetch the user to activate
    const userToActivate = await usersCollection.findOne({ userId: activateIdNum });
    if (!userToActivate) {
      return res.status(404).json({
        success: false,
        message: "User to activate not found",
      });
    }

    if (userToActivate.status === "active") {
      return res.status(400).json({
        success: false,
        message: "This account is already active",
      });
    }

    // Update sponsor and activate user
    await usersCollection.updateOne(
      { userId: sponsorIdNum },
      { $inc: { balance: -599 } }
    );

    await usersCollection.updateOne(
      { userId: activateIdNum },
      { $set: { status: "active" } }
    );

    return res.json({
      success: true,
      message: "Account activated successfully",
      newBalance: (sponsor.balance || 0) - 599,
    });
  } catch (error) {
    console.error("Error activating account:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Add Job
app.post("/api/jobs", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const { userId, userName, userAvatar, name,contact, from, liveAt, experience, salary, position } = req.body;

    if (!userId || !userName || !name || !salary || !position) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newJob = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      from: from || "",
      liveAt: liveAt || "",
      experience: experience || "",
      salary,
      position,
      postedAt: new Date()
    };

    const result = await jobsCollection.insertOne(newJob);
    res.status(201).json({
      success: true,
      message: "Job posted successfully",
      jobId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting job:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Add Worker
app.post("/api/workers", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const { userId, userName, userAvatar, name,contact, from, liveAt, experience, salary, position } = req.body;

    // Required fields check
    if (!userId || !userName || !name || !salary || !position) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newWorker = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      from: from || "",
      liveAt: liveAt || "",
      experience: experience || "",
      salary,
      position,
      postedAt: new Date()
    };

    const result = await workersCollection.insertOne(newWorker);
    res.status(201).json({
      success: true,
      message: "Worker posted successfully",
      workerId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting worker:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all jobs
app.get("/api/jobs", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const jobs = await jobsCollection
      .find({})
      .sort({ postedAt: -1 }) // সর্বশেষ আগে
      .toArray();

    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    console.error("❌ Error fetching jobs:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all workers
app.get("/api/workers", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const workers = await workersCollection
      .find({})
      .sort({ postedAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: workers });
  } catch (error) {
    console.error("❌ Error fetching workers:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Add Buy Post
app.post("/api/marketplace/buy", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const {
      userId,
      userName,
      userAvatar,
      name,
      contact,
      description,
      delivery,
      price,
      imageUrl,
      location
    } = req.body;

    if (!userId || !userName || !name || !price || !imageUrl) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newBuy = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      description: description || "",
      delivery: delivery || "",
      location: location || "",
      price,
      imageUrl,
      postedAt: new Date()
    };

    const result = await buysCollection.insertOne(newBuy);
    res.status(201).json({
      success: true,
      message: "Buy request posted successfully",
      buyId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting buy request:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Add Sell Post
app.post("/api/marketplace/sell", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const {
      userId,
      userName,
      userAvatar,
      name,
      contact,
      description,
      delivery,
      price,
      imageUrl,
      location
    } = req.body;

    if (!userId || !userName || !name || !price || !imageUrl) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newSell = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      description: description || "",
      delivery: delivery || "",
      location: location || "",
      price,
      imageUrl,
      postedAt: new Date()
    };

    const result = await sellsCollection.insertOne(newSell);
    res.status(201).json({
      success: true,
      message: "Sell post created successfully",
      sellId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting sell item:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Get all Buy Posts
app.get("/api/marketplace/buy", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const buys = await buysCollection
      .find({})
      .sort({ postedAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: buys });
  } catch (error) {
    console.error("❌ Error fetching buy posts:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Get all Sell Posts
app.get("/api/marketplace/sell", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const sells = await sellsCollection
      .find({})
      .sort({ postedAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: sells });
  } catch (error) {
    console.error("❌ Error fetching sell posts:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ================== NEED HELP ==================
// Add Need Help Post
app.post("/api/humanity/needhelp", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const {
      userId,
      userName,
      userAvatar,
      name,
      contact,
      description,
      location,
      amount
    } = req.body;

    if (!userId || !userName || !name || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newNeedHelp = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      description: description || "",
      location: location || "",
      amount,
      postedAt: new Date()
    };

    const result = await needHelpsCollection.insertOne(newNeedHelp);
    res.status(201).json({
      success: true,
      message: "Need Help post created successfully",
      needHelpId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting Need Help:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all Need Help Posts
app.get("/api/humanity/needhelp", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const needHelps = await needHelpsCollection
      .find({})
      .sort({ postedAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: needHelps });
  } catch (error) {
    console.error("❌ Error fetching Need Help posts:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Add Social Help Post
app.post("/api/humanity/socialhelp", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const {
      userId,
      userName,
      userAvatar,
      name,
      contact,
      description,
      location,
      amount
    } = req.body;

    if (!userId || !userName || !name || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newSocialHelp = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      description: description || "",
      location: location || "",
      amount,
      postedAt: new Date()
    };

    const result = await socialhelpsCollection.insertOne(newSocialHelp);
    res.status(201).json({
      success: true,
      message: "Social Help post created successfully",
      socialHelpId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting Social Help:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all Social Help Posts
app.get("/api/humanity/socialhelp", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const socialHelps = await socialhelpsCollection
      .find({})
      .sort({ postedAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: socialHelps });
  } catch (error) {
    console.error("❌ Error fetching Social Help posts:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// POST a new Problem
app.post("/api/emergency/problems", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const {
      userId,
      userName,
      userAvatar,
      name,
      contact,
      description,
      location,
      amount
    } = req.body;

    if (!userId || !userName || !name || !contact) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newProblem = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      description: description || "",
      location: location || "",
      amount: amount || null,
      postedAt: new Date()
    };

    const result = await problemsCollection.insertOne(newProblem);
    res.status(201).json({
      success: true,
      message: "Problem post created successfully",
      problemId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting Problem:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET all Problems
app.get("/api/emergency/problems", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const problems = await problemsCollection
      .find({})
      .sort({ postedAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: problems });
  } catch (error) {
    console.error("❌ Error fetching Problems:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// POST a new Solution
app.post("/api/emergency/solutions", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const {
      userId,
      userName,
      userAvatar,
      name,
      contact,
      description,
      location,
      amount
    } = req.body;

    if (!userId || !userName || !name || !contact) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newSolution = {
      userId,
      userName,
      userAvatar: userAvatar || null,
      name,
      contact,
      description: description || "",
      location: location || "",
      amount: amount || null,
      postedAt: new Date()
    };

    const result = await solutionsCollection.insertOne(newSolution);
    res.status(201).json({
      success: true,
      message: "Solution post created successfully",
      solutionId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Error posting Solution:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET all Solutions
app.get("/api/emergency/solutions", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(500).json({ success: false, message: "Database not connected" });
    }

    const solutions = await solutionsCollection
      .find({})
      .sort({ postedAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: solutions });
  } catch (error) {
    console.error("❌ Error fetching Solutions:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
