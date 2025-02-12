const express = require('express'); 
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

/* 📌 Charger les données au démarrage
let users = data.users;  // ✅ Vérifie que `users` est bien un tableau
let userMessages = data.messages; */

// 📌 Charger les utilisateurs et messages stockés
const loadData = () => {
    if (fs.existsSync('serveurmsg.json')) {
        try {
            const data = JSON.parse(fs.readFileSync('serveurmsg.json'));
            return { users: data.users || [], messages: data.messages || {} }; // ⚠️ Ajout de valeurs par défaut
        } catch (error) {
            console.error("❌ Erreur de lecture du fichier serveurmsg.json:", error);
            return { users: [], messages: {} }; // ⚠️ Si le JSON est invalide, retourne des valeurs vides
        }
    }
    return { users: [], messages: {} };
};

const data = loadData();
users = data.users;
userMessages = data.messages; 

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 📂 Configuration du stockage des fichiers uploadés
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 📌 Route pour l'inscription avec photo de profil
app.post('/upload-profile', upload.single('profilePic'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });

    const { username, password } = req.body;
    const userNumber = Math.floor(10000 + Math.random() * 90000);

    // ✅ Vérifie si `users` est bien un tableau
    if (!Array.isArray(users)) {
        users = [];
    }

    // 📌 Vérifier si l'utilisateur existe déjà
    if (users.some(user => user.name === username)) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur déjà utilisé." });
    }

    const newUser = { name: username, password, phone: userNumber, profilePic: req.file.filename };
    users.push(newUser);
    saveData({ users, messages: userMessages });

    res.json({ success: true, user: newUser });
});


// 📌 Route pour l'upload des fichiers envoyés par message
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
    res.json({ success: true, fileName: req.file.filename });
});

// 🎯 WebSockets : Gestion des connexions
io.on('connection', (socket) => {
    console.log(`+ Connexion ID: ${socket.id}`);

    socket.on('newUser', (user) => {
        // 📌 Vérifier si l'utilisateur existe déjà
        const existingUser = users.find(u => u.name === user.name);
        if (existingUser) {
            existingUser.id = socket.id; // Met à jour l'ID en cas de reconnexion
        } else {
            users.push({ ...user, id: socket.id });
        }

        // 📌 Mise à jour des utilisateurs connectés
        io.emit('userStatusUpdate', users);
        saveData({ users, messages: userMessages });
    });

    // 📌 Gestion des messages envoyés
    socket.on('newMessage', (message) => {
        if (!userMessages[message.to]) userMessages[message.to] = [];
        userMessages[message.to].push(message);
        saveData({ users, messages: userMessages });

        const recipient = users.find(u => u.name === message.to);
        if (recipient) io.to(recipient.id).emit('receiveMessage', message);
    });

    // 📌 Gestion de l'envoi de fichiers
    socket.on('newFile', (file) => {
        if (!userMessages[file.to]) userMessages[file.to] = [];
        userMessages[file.to].push(file);
        saveData({ users, messages: userMessages });

        const recipient = users.find(u => u.name === file.to);
        if (recipient) io.to(recipient.id).emit('receiveFile', file);
    });

    // 📌 Indicateur "en train d'écrire"
    socket.on('typing', ({ to, from }) => {
        const recipient = users.find(user => user.name === to);
        if (recipient) io.to(recipient.id).emit('typing', { from });
    });

    // 📌 Déconnexion d'un utilisateur
    socket.on('disconnect', () => {
        const userIndex = users.findIndex(u => u.id === socket.id);
        if (userIndex !== -1) {
            console.log(`X Déconnexion de ${users[userIndex].name}`);
            users.splice(userIndex, 1);
        }
        io.emit('userStatusUpdate', users);
    });
});

// 🚀 Lancer le serveur
server.listen(3000, () => console.log(`Serveur démarré sur http://localhost:3000`));













