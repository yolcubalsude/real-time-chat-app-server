const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    name: { type: String },
    users: [
        {
            username: { type: String, required: true },
            joinedAt: { type: Date, default: Date.now },
            leftAt: { type: Date, default: null },
        },
    ],
    roomId: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Room", RoomSchema);
