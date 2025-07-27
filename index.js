const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = 5000;

// --- CORS Config ---
const corsOptions = {
  origin: ["http://localhost:5173", "https://fulus-topaz.vercel.app"],
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
let bonusesCollection
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

app.get('/api/bonus/by-generation/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: "Invalid userId" });

    const { referrals } = await getReferralsTreeWithGenAndCount(userId);

    // Flatten referrals
    const flattenReferrals = (refList) => {
      let flat = [];
      for (const ref of refList) {
        flat.push({ userId: ref.userId, generation: ref.generation });
        if (ref.referrals?.length) {
          flat = flat.concat(flattenReferrals(ref.referrals));
        }
      }
      return flat;
    };

    const flatReferrals = flattenReferrals(referrals);
    const totalReferrals = flatReferrals.length;

    const bonusConfig = {
      dailyBonus: {
        own: 30, gen1: 30, gen2: 25, gen3: 20, gen4: 15, gen5: 10, gen6: 5, gen7: 3, gen8: 2, gen9: 1, gen10: 0
      },
      generationBonus: {
        own: 0, gen1: 20, gen2: 15, gen3: 10, gen4: 5, gen5: 3, gen6: 2, gen7: 1, gen8: 1, gen9: 1, gen10: 0
      },
      savingsBonus: {
        own: 20, gen1: 20, gen2: 15, gen3: 10, gen4: 5, gen5: 3, gen6: 2, gen7: 1, gen8: 1, gen9: 1, gen10: 0
      }
    };

    const bonusesByGeneration = {
      own: [{
        id: 0,
        userId,
        dailyBonus: bonusConfig.dailyBonus.own,
        genBonus: bonusConfig.generationBonus.own,
        savingsBonus: bonusConfig.savingsBonus.own,
        bonusCollect: await bonusesCollection.findOne({ userId, generation: "own", bonusCollect: true }) ? true : false
      }]
    };

    const genMap = {};

    for (const ref of flatReferrals) {
      const genKey = ref.generation;
      if (!bonusesByGeneration[genKey]) bonusesByGeneration[genKey] = [];
      if (!genMap[genKey]) genMap[genKey] = 0;

      const isCollected = await bonusesCollection.findOne({
        userId: userId,
        fromUserId: ref.userId,
        generation: genKey,
        bonusCollect: true
      });

      bonusesByGeneration[genKey].push({
        id: genMap[genKey]++,
        userId: ref.userId,
        dailyBonus: bonusConfig.dailyBonus[genKey] || 0,
        genBonus: bonusConfig.generationBonus[genKey] || 0,
        savingsBonus: bonusConfig.savingsBonus[genKey] || 0,
        bonusCollect: !!isCollected
      });
    }

    // 👇 Include memberCount here
    res.json({
      success: true,
      userId,
      memberCount: totalReferrals,
      bonusesByGeneration
    });

  } catch (error) {
    console.error("Error fetching bonuses by generation:", error);
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
        own: 30, gen1: 30, gen2: 25, gen3: 20, gen4: 15, gen5: 10, gen6: 5, gen7: 3, gen8: 2, gen9: 1, gen10: 0
      },
      generationBonus: {
        own: 0, gen1: 20, gen2: 15, gen3: 10, gen4: 5, gen5: 3, gen6: 2, gen7: 1, gen8: 1, gen9: 1, gen10: 0
      },
      savingsBonus: {
        own: 20, gen1: 20, gen2: 15, gen3: 10, gen4: 5, gen5: 3, gen6: 2, gen7: 1, gen8: 1, gen9: 1, gen10: 0
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

    const memberCount = await usersCollection.countDocuments({ sponsorId: userId });

    // Update user’s earnings
    await usersCollection.updateOne(
      { userId },
      {
        $inc: {
          balance: dailyBonus + genBonus + savingsBonus,
          generationBonus: genBonus,
          savings: savingsBonus,
          dailyIncome: dailyBonus,
          memberCount: memberCount
        }
      }
    );

    res.json({ success: true, message: "Bonus collected successfully" });

  } catch (error) {
    console.error("Error collecting bonus:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});





// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
