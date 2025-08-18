const express = require("express");
const app = express();
const mongoose = require("mongoose");
require("dotenv").config();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const Room = require("./models/room");

app.use(cors());

console.log(process.env.MONGO_URI)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));


const server = http.createServer(app);

const io = new Server(server, {   
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }, 
});




const Message = require("./models/Message");

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);


  socket.on("create_room", async ({ name, password }, cb) => {
    try {
      const room = await Room.create({ name, password });
      cb({ ok: true, room });
    } catch (err) {
      cb({ ok: false, error: "Oda oluşturulamadı" });
    }
  });
  
  
  socket.on("join_room", async ({ name, password }, cb) => {
    const room = await Room.findOne({ name });
    if (!room) return cb({ ok: false, error: "Oda bulunamadı" });
    if (room.password !== password) return cb({ ok: false, error: "Şifre yanlış" });
  
    socket.join(name);
    cb({ ok: true });
  });
  socket.on("send_message", async (data) => {
    try {
      const newMessage = new Message(data);
      await newMessage.save();
      socket.to(data.room).emit("receive_message", data);
    } catch (err) {
      console.error("Message save error:", err);
    }
  });

  
  

  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
  });
});

app.get("/", (req, res) => {
  res.send("ok");
});

app.get("/messages/:room", async (req, res) => {
  try {
    const room = req.params.room;
    const messages = await require("./models/Message").find({ room });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});


server.listen(3001, () => {
  console.log("SERVER RUNNING");
});

