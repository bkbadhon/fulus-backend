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
let isConnected = false;

async function connectToMongoDB() {
  try {
    if (!client.topology?.isConnected()) {
      await client.connect();
    }
    const db = client.db("fulus");
    usersCollection = db.collection("users");
    generationsCollection = db.collection("generations");
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

app.post('/api/bonus/collect-all/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: "Invalid userId" });

    // You can call the generation, daily income, and savings bonus logic here, for example:

    // For demonstration, assume you have helper functions:
    // await distributeGenerationBonus(userId);
    // await distributeDailyIncomeBonus(userId);
    // await distributeSavingsBonus(userId);

    // Here just call your existing APIs internally or repeat the logic:

    // For now, simply respond success:
    res.json({ success: true, message: "All bonuses distributed (implement logic)" });
  } catch (error) {
    console.error("Collect all bonuses error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
