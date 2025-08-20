

const express = require("express");
const User = require("../models/User");
const router = express.Router();
const bcrypt = require("bcrypt");

// Kayıt (Register)
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);


    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: "Kullanıcı zaten var" });


    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Kayıt başarılı" });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Giriş (Login)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(400).json({ message: "Kullanıcı bulunamadı" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Şifre yanlış" });
    }

    res.json({ message: "Giriş başarılı!" });
  } catch (err) {
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
});

module.exports = router;


