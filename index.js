const express = require("express");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = 5000;

// --- CORS Config ---
const corsOptions = {
  origin: ["http://localhost:5173", "https://fulus-topaz.vercel.app",'https://fulus-admin.vercel.app', 'http://localhost:5174'],
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
let genCollection;
let dailyIncomeCollection

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
    genCollection = db.collection("dailygen");
    dailyIncomeCollection=db.collection('dailyincome')

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

    const existing = await usersCollection.findOne({ userId: Number(userId) });
    if (existing) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

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
      chargeAmount: chargeAmount || 0,
      sponsorId: sponsorId ? Number(sponsorId) : null,
    };

    const result = await usersCollection.insertOne(newUser);

    // ✅ Generation Mapping Logic
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
    res.status(201).json({ success: true, user: createdUser });
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

app.post('/api/bonus/savings/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const savingsBonusSettings = {
      sponsorid: 10,
      ownid: 20,
      g2: 8,
      g3: 6,
      g4: 4,
      g5: 2,
      g6: 0,
      g7: 0,
      g8: 0,
      g9: 0,
      g10: 0,
    };

    // Fetch generation chain logic same as above
    let currentUserId = userId;
    const generations = {};

    for (let i = 1; i <= 10; i++) {
      const user = await usersCollection.findOne({ userId: currentUserId });
      if (!user) break;
      if (i === 1) generations[`g1`] = currentUserId;
      else {
        if (!user.sponsorId) break;
        generations[`g${i}`] = user.sponsorId;
        currentUserId = user.sponsorId;
      }
    }

    const bonuses = [];

    // Own savings bonus
    bonuses.push({
      userId,
      amount: savingsBonusSettings.ownid,
      reason: "Own savings bonus",
    });

    // Sponsor savings bonus (g1)
    if (generations.g2) {
      bonuses.push({
        userId: generations.g2,
        amount: savingsBonusSettings.sponsorid,
        reason: "Sponsor savings bonus (g1)",
      });
    }

    // Generations g2 to g10 savings bonuses
    for (let i = 2; i <= 10; i++) {
      const genUserId = generations[`g${i+1}`]; // offset
      const amount = savingsBonusSettings[`g${i}`];
      if (genUserId && amount > 0) {
        bonuses.push({
          userId: genUserId,
          amount,
          reason: `Savings bonus g${i}`,
        });
      }
    }

    // Update balances
    for (const b of bonuses) {
      await usersCollection.updateOne({ userId: b.userId }, { $inc: { balance: b.amount } });
    }

    res.json({ success: true, userId, generations, distributedBonuses: bonuses });
  } catch (error) {
    console.error("Savings bonus error:", error);
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

// Recursive function to get referrals tree with generation labels and count
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



app.get("/api/users/:userId/gen1-ref-count", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Step 1: Get all Gen1 (direct referrals)
    const gen1Users = await usersCollection
      .find({ sponsorId: userId })
      .project({ password: 0 })
      .toArray();

    if (!gen1Users.length) {
      return res.json({ success: true, userId, gen1Details: [] });
    }

    // Step 2: For each Gen1, count their direct referrals
    const gen1Details = await Promise.all(
      gen1Users.map(async (gen1) => {
        const gen1RefCount = await usersCollection.countDocuments({ sponsorId: gen1.userId });
        return {
          userId: gen1.userId,
          name: gen1.name,
          phone: gen1.phone,
          gen1RefCount // এই Gen1 কতোজনকে রেফার করেছে
        };
      })
    );

    res.json({
      success: true,
      userId,
      totalGen1: gen1Users.length,
      gen1Details
    });

  } catch (error) {
    console.error("Error fetching gen1 referral count:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.post('/api/users/collect-reward', async (req, res) => {
  try {
    const { userId, rank, type, amount } = req.body;

    if (!userId || !rank || !type || amount === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // Convert gold string like "2.10g" to number 2.10 if type is gold
    let numericAmount = amount;
    if (type === 'gold' && typeof amount === 'string') {
      numericAmount = parseFloat(amount.replace(/[^\d.]/g, ''));
      if (isNaN(numericAmount)) {
        return res.status(400).json({ success: false, message: "Invalid gold amount." });
      }
    }

    // Find user document
    const user = await usersCollection.findOne({ userId });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Prepare update fields
    const updateFields = {};

    // Initialize rankBonus object if missing
    if (!user.rankBonus) user.rankBonus = {};

    // Check if reward already collected (sar or gold) for this rank
    const collectedKey = `${rank}-${type}`;
    if (user.rankBonus[collectedKey]) {
      return res.status(400).json({ success: false, message: "Reward already collected." });
    }

    // Update SAR or Gold balance and record collection in rankBonus
    if (type === 'sar') {
      updateFields.balance = (user.balance || 0) + numericAmount;
      updateFields[`rankBonus.${collectedKey}`] = numericAmount; // save amount collected
    } else if (type === 'gold') {
      updateFields.goldBalance = (user.goldBalance || 0) + numericAmount;
      updateFields[`rankBonus.${collectedKey}`] = numericAmount;
    }

    // Update user document atomically
    await usersCollection.updateOne(
      { userId },
      { $set: updateFields }
    );

    return res.json({ success: true, message: "Reward collected successfully." });
  } catch (error) {
    console.error('Collect reward error:', error);
    return res.status(500).json({ success: false, message: "Server error." });
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


app.post('/api/bonus/collect', async (req, res) => {
  try {
    const { userId, fromUserId, generation } = req.body;
    if (!userId || !generation || !fromUserId) {
      return res.status(400).json({ success: false, message: "Missing userId, fromUserId or generation" });
    }

    // Prevent duplicate collection
    const existing = await bonusesCollection.findOne({ userId, fromUserId, generation });
    if (existing?.bonusCollect) {
      return res.status(400).json({ success: false, message: "Bonus already collected" });
    }

    const bonusConfig = {
      dailyBonus: {
        own: 0, gen1: 30, gen2: 25, gen3: 20, gen4: 15, gen5: 10, gen6: 5, gen7: 3, gen8: 2, gen9: 1, gen10: 0
      },
      generationBonus: {
        own: 0, gen1: 20, gen2: 15, gen3: 10, gen4: 5, gen5: 3, gen6: 2, gen7: 1, gen8: 1, gen9: 1, gen10: 0
      },
      savingsBonus: {
        own: 0, gen1: 20, gen2: 15, gen3: 10, gen4: 5, gen5: 3, gen6: 2, gen7: 1, gen8: 1, gen9: 1, gen10: 0
      }
    };

    const dailyBonus = bonusConfig.dailyBonus[generation] || 0;
    const genBonus = bonusConfig.generationBonus[generation] || 0;
    const savingsBonus = bonusConfig.savingsBonus[generation] || 0;

    // Save collected bonus record
    await bonusesCollection.updateOne(
      { userId, fromUserId, generation },
      {
        $set: {
          bonusCollect: true,
          collectedAt: new Date(),
          dailyBonus,
          genBonus,
          savingsBonus
        }
      },
      { upsert: true }
    );

    // Count members for user stats
    const memberCount = await usersCollection.countDocuments({ sponsorId: userId });

    // Update user’s earnings & total collected stats
    const updateResult = await usersCollection.findOneAndUpdate(
      { userId },
      {
        $inc: {
          balance: dailyBonus + genBonus + savingsBonus,
          generationBonus: genBonus,
          savings: savingsBonus,
          dailyIncome: dailyBonus,
          memberCount: memberCount,
          totalSavingsCollected: savingsBonus,            // ✅ Track total savings collected
          totalGenerationBonusCollected: genBonus         // ✅ Track total generation collected
        }
      },
      { returnDocument: "after" }  // or use { returnOriginal: false } in older MongoDB drivers
    );

    // Safely handle case where user is not found
    const updatedUser = updateResult?.value || {};

    res.json({
      success: true,
      message: "Bonus collected successfully",
      totalSavingsCollected: updatedUser.totalSavingsCollected || 0,
      totalGenerationBonusCollected: updatedUser.totalGenerationBonusCollected || 0,
      currentBalance: updatedUser.balance || 0
    });

  } catch (error) {
    console.error("Error collecting bonus:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




app.post('/api/withdraw', async (req, res) => {
  try {
    const { userId, method, amount, deliveryAddress, accountNumber } = req.body;
    const withdrawAmount = Number(amount);

    if (!userId || !withdrawAmount || withdrawAmount <= 0) {
      return res.json({ success: false, message: 'Invalid withdraw request' });
    }

    const user = await usersCollection.findOne({ userId: Number(userId) });
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    const totalBalance = user.balance || 0;
    const savings = user.savings || 0;
    const daily = user.dailyIncome || 0;
    const gen = user.generationBonus || 0;

    if (totalBalance < withdrawAmount) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }

    // Deduct from balance
    const newBalance = totalBalance - withdrawAmount;

    // Sum of savings + daily + gen
    const totalSubAccounts = savings + daily + gen;

    let newSavings = savings;
    let newDaily = daily;
    let newGen = gen;

    if (totalSubAccounts >= withdrawAmount) {
      // Deduct withdrawAmount from savings, daily, gen in order

      let remaining = withdrawAmount;

      if (newSavings >= remaining) {
        newSavings -= remaining;
        remaining = 0;
      } else {
        remaining -= newSavings;
        newSavings = 0;
      }

      if (remaining > 0) {
        if (newDaily >= remaining) {
          newDaily -= remaining;
          remaining = 0;
        } else {
          remaining -= newDaily;
          newDaily = 0;
        }
      }

      if (remaining > 0) {
        if (newGen >= remaining) {
          newGen -= remaining;
          remaining = 0;
        } else {
          // Should not happen because totalSubAccounts >= withdrawAmount
          newGen = 0;
          remaining = 0;
        }
      }
    } else {
      // If not enough in sub accounts, set all to zero
      newSavings = 0;
      newDaily = 0;
      newGen = 0;
    }

    // Update user document
    const updateResult = await usersCollection.updateOne(
      { userId: Number(userId) },
      {
        $set: {
          balance: newBalance,
          savings: newSavings,
          dailyIncome: newDaily,
          generationBonus: newGen,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.json({ success: false, message: 'Failed to update user balances' });
    }

    // Insert withdraw request
    await withdrawCollection.insertOne({
      userId: Number(userId),
      method,
      amount: withdrawAmount,
      deliveryAddress,
      accountNumber,
      status: 'Pending',
      createdAt: new Date(),
    });

    return res.json({ success: true, message: 'Withdraw request submitted successfully' });
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



// Approve or Reject withdraw
app.patch("/api/withdraw/:id", async (req, res) => {
  try {
    const { status, userId, amount } = req.body;
    const id = req.params.id;

    if (!status) return res.json({ success: false, message: "Status is required" });

    // Update withdraw status
    const result = await withdrawCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (status === "rejected") {
      // Refund amount to user balance
      await usersCollection.updateOne(
        { userId: Number(userId) },
        { $inc: { balance: Number(amount) } }
      );
    }

    return res.json({ success: result.modifiedCount > 0 });
  } catch (error) {
    console.error("Withdraw update error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
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

    if (fromUser.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Perform the balance transfer
    await usersCollection.updateOne(
      { userId: fromUser.userId },
      { $inc: { balance: -amount } }
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
        const { userId, amount, transactionId, agentNumber } = req.body;

        if (!userId || !amount || !transactionId || !agentNumber) {
            return res.json({ success: false, message: 'All fields are required!' });
        }

        const depositData = {
            userId: Number(userId),
            amount: Number(amount),
            transactionId,
            agentNumber, // Store in DB
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
    const { userId } = req.params;

    const deposits = await depositCollection
        .find({ userId: Number(userId) })
        .sort({ createdAt: -1 })
        .toArray();

    const withdraws = await withdrawCollection
        .find({ userId: Number(userId) })
        .sort({ createdAt: -1 })
        .toArray();

    // Combine and sort by date
    const allTransactions = [...deposits.map(t => ({...t, type:'deposit'})), ...withdraws.map(t => ({...t, type:'withdraw'}))]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, transactions: allTransactions });
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
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res
        .status(400)
        .json({ success: false, message: "Missing userId or amount" });
    }

    // Convert userId to number to keep consistent
    const userIdNum = Number(userId);

    // Check if today is Friday
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay(); // 0 = Sunday, 5 = Friday
    if (dayOfWeek !== 5) {
      return res.json({ success: false, message: "Withdrawals allowed only on Fridays" });
    }

    const todayStr = todayDate.toISOString().split("T")[0];

    // Prevent multiple collections on the same day
    const collectedToday = await genCollection.findOne({ userId: userIdNum, date: todayStr });
    if (collectedToday) {
      return res.json({ success: false, message: "Already collected today" });
    }

    // Insert collection record
    await genCollection.insertOne({
      userId: userIdNum,
      amount: Number(amount),
      date: todayStr,
      collectedAt: new Date(),
    });

    // Update user: add to main balance and reduce generationBonus
    await usersCollection.updateOne(
      { userId: userIdNum },
      {
        $inc: { balance: Number(amount) },
        $inc: { generationBonus: -Number(amount) },
      }
    );

    res.json({
      success: true,
      message: "Generation commission collected successfully and added to balance!",
    });

  } catch (error) {
    console.error("Error collecting generation commission:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.post("/api/daily-income/collect", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: "Missing userId or amount" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Check if already collected today
    const collectedToday = await dailyIncomeCollection.findOne({ userId, date: today });
    if (collectedToday) {
      return res.json({ success: false, message: "Already collected today" });
    }

    // Update user balance & daily income
    await usersCollection.updateOne(
      { userId },
      {
        $inc: { balance: amount, dailyIncome: amount },
        $set: { lastDailyCollect: today },
      }
    );

    // Record collection history
    await dailyIncomeCollection.insertOne({
      userId,
      amount,
      date: today,
      collectedAt: new Date(),
    });

    res.json({ success: true, message: "Daily income collected!" });
  } catch (error) {
    console.error("Error collecting daily income:", error);
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





// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
