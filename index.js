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

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
