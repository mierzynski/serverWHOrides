const dotenv = require("dotenv").config();
const PORT = 8000;
const express = require("express");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
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
app.use(express.json({ limit: 52428800 }));

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
      birth_year: parseInt(birthDate),
      location: location,
      description: "",
      rates: [],
      comments: [],
      bike_types: ["", "", ""],
      surface_types: ["", "", ""],
      distance_max: "",
      distance_min: "",
      pace_max: "",
      pace_min: "",
      friends: [],
      events: [],
      images: [],
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

    if (user) {
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
    } else {
      res.status(400).json("Invalid Credentials");
    }
  } catch (err) {
    console.log(err);
  } finally {
    await client.close();
  }
});

app.put("/updateuser", async (req, res) => {
  const client = new MongoClient(uri);
  const { userData } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: userData.user_id };
    const data = {
      $set: {
        location: userData.location,
        description: userData.description,
        distance_min: userData.distance_min,
        distance_max: userData.distance_max,
        pace_min: userData.pace_min,
        pace_max: userData.pace_max,
        bike_types: userData.bike_types,
        surface_types: userData.surface_types,
      },
    };
    const insertUser = await users.updateOne(query, data);
    res.send(insertUser);
  } finally {
    await client.close();
  }
});

app.get("/users", async (req, res) => {
  const client = new MongoClient(uri);
  const userId = req.query.userId;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: userId };
    const user = await users.findOne(query);
    res.send(user);
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

    const queryAge = {
      $and: [
        { birth_year: { $gte: parseInt(filters.birth_max) } },
        { birth_year: { $lte: parseInt(filters.birth_min) } },
      ],
    };

    const usersByAge = await users.find(queryAge).toArray();

    let filteredUsers_partOne = usersByAge.filter(function (el) {
      if (
        el.location &&
        el.distance_max &&
        el.distance_min &&
        el.pace_max &&
        el.pace_min
      ) {
        return (
          el.location == filters.location &&
          el.distance_max <= filters.distance_max &&
          el.distance_min >= filters.distance_min &&
          el.pace_max <= filters.pace_max &&
          el.pace_min >= filters.pace_min
        );
      } else if (
        el.location &&
        el.distance_max &&
        el.distance_min &&
        el.pace_max
      ) {
        return (
          el.location == filters.location &&
          el.distance_max <= filters.distance_max &&
          el.distance_min >= filters.distance_min &&
          el.pace_max <= filters.pace_max
        );
      } else if (el.location && el.distance_max && el.distance_min) {
        return (
          el.location == filters.location &&
          el.distance_max <= filters.distance_max &&
          el.distance_min >= filters.distance_min
        );
      } else if (el.location && el.distance_max) {
        return (
          el.location == filters.location &&
          el.distance_max <= filters.distance_max
        );
      } else if (el.location) {
        return el.location == filters.location;
      }
    });
    // let filteredUsers_full = usersByAge.filter(function (el) {
    //   const containTypes = (element) =>
    //     element === "road" || element === "gravel" || element === "mtb";
    //   let notEmptyBikeTypes = [];
    //   let notEmptySurfaceTypes = [];
    //   if (
    //     filters.bike_types[0] + filters.bike_types[1] + filters.bike_types[2] !=
    //     ""
    //   ) {
    //     notEmptyBikeTypes = filters.bike_types.filter(containTypes);
    //   }
    //   if (
    //     filters.surface_types[0] +
    //       filters.surface_types[1] +
    //       filters.surface_types[2] !=
    //     ""
    //   ) {
    //     notEmptySurfaceTypes = filters.surface_types.filter(containTypes);
    //   }

    //   if (notEmptyBikeTypes.length != 0 && notEmptySurfaceTypes.length != 0) {
    //     console.log("not empty");
    //   } else if (notEmptyBikeTypes.length != 0) {
    //     if (el.bike_types) {
    //       return (
    //         el.bike_types[0] == "road" ||
    //         el.bike_types[1] == "gravel" ||
    //         el.bike_types[2] == "mtb"
    //       );
    //     }
    //   } else if (notEmptySurfaceTypes.length != 0) {
    //     console.log("not empty surface types");
    //   }
    // });

    // console.log(filteredUsers_full);

    if (filteredUsers_partOne.length > 0) {
      res.send(filteredUsers_partOne);
    } else {
      res.send(usersByAge);
    }
  } finally {
    await client.close();
  }
});

app.post("/createevent", async (req, res) => {
  const client = new MongoClient(uri);
  const { detailsObj } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const events = database.collection("events");

    // const existingEvent = await users.findOne({ _id: detailsObj._id });

    // if (existingUser) {
    //   return res.status(409).send("Event already exist");
    // }

    const data = {
      title: detailsObj.title,
      author_id: detailsObj.author_id,
      meeting_date: detailsObj.meeting_date,
      participants: detailsObj.participants,
      distance: parseInt(detailsObj.distance),
      avg_pace: parseInt(detailsObj.avg_pace),
      surface: detailsObj.surface,
      location: detailsObj.startLocation,
      description: detailsObj.description,
      map_img: detailsObj.map_img,
      is_public: detailsObj.isPublic,
    };
    const insertedEvent = await events.insertOne(data);

    res.send(insertedEvent);
  } catch (err) {
    console.log(err);
  }
});

app.get("/findevents", async (req, res) => {
  const client = new MongoClient(uri);
  const filters = req.query.filters;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("events");

    const events = await users.find().toArray();

    if (filters) {
      const filteredEvents = events.filter(function (el) {
        if (
          filters.distanceMin &&
          filters.distanceMax &&
          filters.avgPaceMin &&
          filters.avgPaceMax &&
          filters.surface &&
          filters.startLocation
        ) {
          return (
            el.distance >= filters.distanceMin &&
            el.distance <= filters.distanceMax &&
            el.avg_pace >= filters.avgPaceMin &&
            el.avg_pace <= filters.avgPaceMax &&
            el.surface == filters.surface &&
            el.location == filters.startLocation
          );
        } else if (
          filters.distanceMin &&
          filters.distanceMax &&
          filters.avgPaceMin &&
          filters.avgPaceMax &&
          filters.surface
        ) {
          return (
            el.distance >= filters.distanceMin &&
            el.distance <= filters.distanceMax &&
            el.avg_pace >= filters.avgPaceMin &&
            el.avg_pace <= filters.avgPaceMax &&
            el.surface == filters.surface
          );
        } else if (
          filters.distanceMin &&
          filters.distanceMax &&
          filters.avgPaceMin &&
          filters.avgPaceMax
        ) {
          return (
            el.distance >= filters.distanceMin &&
            el.distance <= filters.distanceMax &&
            el.avg_pace >= filters.avgPaceMin &&
            el.avg_pace <= filters.avgPaceMax
          );
        } else if (
          filters.distanceMin &&
          filters.distanceMax &&
          filters.avgPaceMin
        ) {
          return (
            el.distance >= filters.distanceMin &&
            el.distance <= filters.distanceMax &&
            el.avg_pace >= filters.avgPaceMin
          );
        } else if (filters.distanceMin && filters.distanceMax) {
          return (
            el.distance >= filters.distanceMin &&
            el.distance <= filters.distanceMax
          );
        } else if (filters.distanceMin) {
          return el.distance >= filters.distanceMin;
        }
      });

      res.send(filteredEvents);
    } else {
      res.send(events);
    }
  } finally {
    await client.close();
  }
});

app.get("/userevents", async (req, res) => {
  const client = new MongoClient(uri);
  const user_id = req.query.user_id;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("events");

    const query = { author_id: user_id };

    const events = await users.find(query).toArray();

    res.send(events);
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

app.post("/joinevent", async (req, res) => {
  const client = new MongoClient(uri);
  const { participant, eventId } = req.body;
  const oid = new ObjectId(eventId);

  try {
    await client.connect();
    const database = client.db("app-data");
    const events = database.collection("events");
    const users = database.collection("users");

    const query = {
      _id: oid,
      "participants.user_id": participant.user_id,
    };

    const findParticipant = await events.findOne(query);

    if (findParticipant) {
      res.send("You are already a participant");
    } else {
      const insertedParticipant = await events.findOneAndUpdate(
        { _id: oid },
        {
          $push: {
            participants: {
              date: participant.date,
              user_id: participant.user_id,
              isAccepted: participant.isAccepted,
            },
          },
        }
      );

      const addEventToUser = await users.findOneAndUpdate(
        { user_id: participant.user_id },
        {
          $push: {
            events: participant.user_id,
          },
        }
      );

      res.send("Joined to event");
    }
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

    const allFriends = await users
      .find({ user_id: { $in: foundUserFriendsIds.friends } })
      .toArray();

    res.send({
      pendingFriends: pendingFriends,
      acceptedFriends: acceptedFriends,
      allFriends: allFriends,
    });
  } finally {
    await client.close();
  }
});

app.get("/ispendingfriend", async (req, res) => {
  const client = new MongoClient(uri);
  const { userId, friendId } = req.query;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: { $eq: userId } };

    const foundUserFriendsIds = await users.findOne(queryFriendsIds, {
      projection: { friends: 1, _id: 0 },
    });

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

  const chatId1 = chat.members_id[1] + ";" + chat.members_id[0];
  const chatId2 = chat.members_id[0] + ";" + chat.members_id[1];
  try {
    await client.connect();
    const database = client.db("app-data");
    const chats = database.collection("chats");

    const foundChat1 = await chats.findOne({ chatId: chatId1 });
    const foundChat2 = await chats.findOne({ chatId: chatId2 });

    if (foundChat1) {
      res.status(201).json({ chat: foundChat1 });
    } else if (foundChat2) {
      res.status(201).json({ chat: foundChat1 });
    } else {
      const insertChat = await chats.insertOne(chat);
      const foundInsertedChat = await chats.findOne({ chatId: chat.chatId });
      res.status(201).json({ chat: foundInsertedChat });
    }
  } finally {
    await client.close();
  }
});

app.put("/createcomment", async (req, res) => {
  const client = new MongoClient(uri);
  const { newComment, ratedUserId } = req.body;
  let isExist = false;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: ratedUserId.ratedUserId };
    const updateRates = {
      $push: { rates: newComment.rate },
    };

    const updateComments = {
      $push: { comments: newComment },
    };

    const user = await users.findOne(query);

    if (user) {
      user.comments.forEach((element) => {
        if (element.user_id == newComment.user_id) {
          isExist = true;
        }
      });
    }

    if (isExist) {
      res.send("Comment already exist");
    } else {
      const addComment = await users.updateOne(query, updateComments);
      const addRate = await users.updateOne(query, updateRates);
      res.send("Done");
    }
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

    const user = await users.findOne(query);

    if (user.friends.includes(invitedUserId)) {
      res.send("Already invited");
    } else {
      const inviteFriend = await users.updateOne(query, updateDocument);
      res.send(inviteFriend);
    }
  } finally {
    await client.close();
  }
});

app.put("/acceptfriend", async (req, res) => {
  const client = new MongoClient(uri);
  const { user, friendId } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: user };
    const updateDocument = {
      $push: { friends: friendId },
    };
    const updateFriend = await users.updateOne(query, updateDocument);
    res.send(updateFriend);
  } finally {
    await client.close();
  }
});

app.put("/uploadphoto", async (req, res) => {
  const client = new MongoClient(uri);
  const { user_id, img } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: user_id };
    const updateDocument = {
      $push: { images: img },
    };
    const uploadPhoto = await users.updateOne(query, updateDocument);
    res.send(uploadPhoto);
  } finally {
    await client.close();
  }
});

app.put("/deletephoto", async (req, res) => {
  const client = new MongoClient(uri);
  const { user_id, img } = req.body;

  try {
    await client.connect();
    const database = client.db("app-data");
    const users = database.collection("users");

    const query = { user_id: user_id };
    const deletePhoto = { $pull: { images: img } };
    const updateImages = await users.updateOne(query, deletePhoto);
    res.send(updateImages);
  } finally {
    await client.close();
  }
});

app.listen(PORT, () => console.log("Server running on PORT " + PORT));
