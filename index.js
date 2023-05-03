const dotenv = require("dotenv").config();
const PORT = 8000;
const express = require("express");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");

const uri =
  "mongodb+srv://" +
  process.env.DB_LOGIN +
  "@cluster0.bzfxhwx.mongodb.net/?retryWrites=true&w=majority";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/signup", async (req, res) => {
  const client = new MongoClient(uri);
  const { email, password, birthDate, name, location } = req.body;

  const generatedUserId = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(409).send("User already exist");
    }

    const sanitizedEmail = email.toLowerCase();

    const data = {
      user_id: generatedUserId,
      email: sanitizedEmail,
      hashed_password: hashedPassword,
      name: name,
      birth_year: birthDate,
      location: location,
    };
    const insertedUser = await users.insertOne(data);

    const token = jwt.sign(insertedUser, sanitizedEmail, {
      expiresIn: 60 * 24,
    });

    res
      .status(201)
      .json({ token, userId: generatedUserId, email: sanitizedEmail });
  } catch (err) {
    console.log(err);
  }
});

app.post("/login", async (req, res) => {
  const client = new MongoClient(uri);
  const { email, password } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const user = await users.findOne({ email });

    const correctPassword = await bcrypt.compare(
      password,
      user.hashed_password
    );

    if (user && correctPassword) {
      const token = jwt.sign(user, email, {
        expiresIn: 60 * 24,
      });
      res
        .status(201)
        .json({ token, userId: user.user_id, userName: user.name });
    }

    res.status(400).json("Invalid Credentials");
  } catch (err) {
    console.log(err);
  } finally {
    await client.close();
  }
});

app.put("/users", async (req, res) => {
  const client = new MongoClient(uri);
  const {
    user,
    userLocation,
    description,
    userRangeStart,
    userRangeEnd,
    userAveragePaceStart,
    userAveragePaceEnd,
  } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: user };
    const data = {
      $set: {
        location: userLocation,
        description: description,
        rangeStart: userRangeStart,
        rangeEnd: userRangeEnd,
        averangePaceStart: userAveragePaceStart,
        averangePaceEnd: userAveragePaceEnd,
      },
    };
    const insertUser = await users.updateOne(query, data);
    res.send(insertUser);
    // const insertedUser = await users.insertOne(data);
  } finally {
    await client.close();
  }
});

app.get("/findusers", async (req, res) => {
  const client = new MongoClient(uri);
  const filters = req.query.filters;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = {
      $and: [
        { birth_year: { $gte: parseInt(filters.birth_max) } },
        { birth_year: { $lte: parseInt(filters.birth_min) } },
      ],
    };
    // do dokonczenia
    if (filters.bike_types) {
      if (filters.bike_types[0]) {
        if (filters.bike_types[1]) {
          if (filters.bike_types[2]) {
            query.$and.push({
              $or: [
                { bike_types: filters.bike_types[0] },
                { bike_types: filters.bike_types[1] },
                { bike_types: filters.bike_types[2] },
              ],
            });
          } else {
            query.$and.push({
              $or: [
                { bike_types: filters.bike_types[0] },
                { bike_types: filters.bike_types[1] },
              ],
            });
          }
        } else {
          query.$and.push({ bike_types: filters.bike_types[0] });
        }
      }
      if (filters.bike_types[1]) {
        if (filters.bike_types[2]) {
          query.$and.push({
            $or: [
              { bike_types: filters.bike_types[1] },
              { bike_types: filters.bike_types[2] },
            ],
          });
        } else {
          query.$and.push({ bike_types: filters.bike_types[2] });
        }
      }
      if (filters.bike_types[2]) {
        query.$and.push({ bike_types: filters.bike_types[2] });
      }
    }
    if (filters.surface_types) {
      if (filters.surface_types[0]) {
        if (filters.surface_types[1]) {
          if (filters.surface_types[2]) {
            query.$and.push({
              $or: [
                { surface_types: filters.surface_types[0] },
                { surface_types: filters.surface_types[1] },
                { surface_types: filters.surface_types[2] },
              ],
            });
          } else {
            query.$and.push({
              $or: [
                { surface_types: filters.surface_types[0] },
                { surface_types: filters.surface_types[1] },
              ],
            });
          }
        } else {
          query.$and.push({ surface_types: filters.surface_types[0] });
        }
      }
      if (filters.surface_types[1]) {
        if (filters.surface_types[2]) {
          query.$and.push({
            $or: [
              { surface_types: filters.surface_types[1] },
              { surface_types: filters.surface_types[2] },
            ],
          });
        } else {
          query.$and.push({ surface_types: filters.surface_types[2] });
        }
      }
      if (filters.surface_types[2]) {
        query.$and.push({ surface_types: filters.surface_types[2] });
      }
    }
    if (filters.distance_min) {
      query.$and.push({
        $and: [
          { distance_min: { $lte: filters.distance_min } },
          { distance_max: { $gte: filters.distance_max } },
        ],
      });
    }
    if (filters.pace_min) {
      query.$and.push({
        $and: [
          { pace_min: { $lte: filters.pace_min } },
          { pace_max: { $gte: filters.pace_max } },
        ],
      });
    }
    if (filters.location) {
      query.$and.push({ location: filters.location });
    }

    const foundUsers = await users.find(query).toArray();
    res.send(foundUsers);
  } finally {
    await client.close();
  }
});

app.get("/correspondingusers", async (req, res) => {
  const client = new MongoClient(uri);
  const tmpArrayCorrespondingUsers = req.query.tmpArrayCorrespondingUsers;
  console.log(tmpArrayCorrespondingUsers);

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: { $eq: tmpArrayCorrespondingUsers[0] } };
    const foundUsers = await users.find(query).toArray();
    res.send(foundUsers);
  } finally {
    await client.close();
  }
});

app.get("/messages", async (req, res) => {
  const { userId, correspondingUserId } = req.query;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db("app-data");
    const messages = database.collection("messages");

    const query = {
      from_userId: userId,
      to_userId: correspondingUserId,
    };
    const foundMessages = await messages.find(query).toArray();
    res.send(foundMessages);
    console.log(foundMessages);
  } finally {
    await client.close();
  }
});

app.get("/chats", async (req, res) => {
  const client = new MongoClient(uri);
  const userId = req.query.userId;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("chats");

    const query = { chatId: { $regex: userId } };

    const foundChats = await users.find(query).toArray();
    res.send(foundChats);
  } finally {
    await client.close();
  }
});

app.post("/message", async (req, res) => {
  const client = new MongoClient(uri);
  const message = req.body.message;

  try {
    await client.connect();
    const database = client.db("app-data");
    const chats = database.collection("chats");

    const insertedMessage = await chats.findOneAndUpdate(
      { chatId: message.chatId },
      {
        $push: {
          messages: {
            date: message.date,
            msg: message.message,
            sender_id: message.sender_id,
            sender_name: message.sender_name,
          },
        },
      }
    );
    res.send(insertedMessage);
  } finally {
    await client.close();
  }
});

app.get("/currentchat", async (req, res) => {
  const client = new MongoClient(uri);
  const chatId = req.query.chatId;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("chats");

    const query = { chatId: chatId };

    const foundChat = await users.findOne(query);
    res.send(foundChat);
  } finally {
    await client.close();
  }
});

app.get("/friends", async (req, res) => {
  const client = new MongoClient(uri);
  const userId = req.query.userId;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const queryFriendsIds = { user_id: { $eq: userId } };

    const foundUserFriendsIds = await users.findOne(queryFriendsIds, {
      projection: { friends: 1, _id: 0 },
    });

    const acceptedFriends = await users
      .find({ user_id: { $in: foundUserFriendsIds.friends }, friends: userId })
      .toArray();

    const pendingFriends = await users
      .find({
        user_id: { $not: { $in: foundUserFriendsIds.friends } },
        friends: userId,
      })
      .toArray();

    res.send({
      pendingFriends: pendingFriends,
      acceptedFriends: acceptedFriends,
    });
  } finally {
    await client.close();
  }
});

app.post("/newchat", async (req, res) => {
  const client = new MongoClient(uri);
  const chat = req.body.newChat;

  try {
    await client.connect();
    const database = client.db("app-data");
    const chats = database.collection("chats");

    const insertChat = await chats.insertOne(chat);
    const foundChat = await chats.findOne({ chatId: chat.chatId });
    res.status(201).json({ chat: foundChat });
  } finally {
    await client.close();
  }
});

app.put("/invitefriend", async (req, res) => {
  const client = new MongoClient(uri);
  const { userId, invitedUserId } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: userId };
    const updateDocument = {
      $push: { friends: invitedUserId },
    };
    const user = await users.updateOne(query, updateDocument);
    res.send(user);
  } finally {
    await client.close();
  }
});

app.listen(PORT, () => console.log("Server running on PORT " + PORT));
