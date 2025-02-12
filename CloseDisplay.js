console.log("✅ CloseDisplay.js chargé.");

const socket = io.connect(`${window.location.hostname}:3000`);
let username = null;
let activeRecipient = null;
let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
let messages = JSON.parse(localStorage.getItem("messages")) || {};

// 📌 Fonction pour afficher une notification
function showNotification(message, isError = false) {
    const notification = document.getElementById("notification");
    if (!notification) return;
    notification.textContent = message;
    notification.className = isError ? "notification error" : "notification";
    notification.style.display = "block";
    setTimeout(() => {
        notification.style.display = "none";
    }, 3000);
}

// 📌 Vérifie si un utilisateur est déjà connecté
const storedUser = JSON.parse(localStorage.getItem("user"));
if (storedUser) {
    updateUserDisplay(storedUser);
}

// 📌 Fonction pour mettre à jour l'affichage de l'utilisateur (nom + image)
function updateUserDisplay(user) {
    const loginImg = document.getElementById("loginimg");
    const informationDiv = document.getElementById("information");

    if (loginImg && user.profilePic) {
        loginImg.src = `/uploads/${user.profilePic}`;
        loginImg.style.display = "block";
    }

    if (informationDiv) {
        informationDiv.textContent = `${user.name} - ${user.phone}`;
    }
}

// 📌 Génération d'un numéro unique (5 chiffres)
function generateUserNumber() {
    let userNumbers = JSON.parse(localStorage.getItem("userNumbers")) || [];
    let newNumber;

    do {
        newNumber = Math.floor(10000 + Math.random() * 90000);
    } while (userNumbers.includes(newNumber));

    userNumbers.push(newNumber);
    localStorage.setItem("userNumbers", JSON.stringify(userNumbers));
    return newNumber;
}

// 📌 Connexion utilisateur avec ajout de photo de profil
document.getElementById("startChatButton")?.addEventListener("click", () => {
    const usernameInput = document.getElementById("usernameInput");
    const passwordInput = document.getElementById("password");
    const profilePicInput = document.getElementById("profilePicInput");

    if (!usernameInput || !passwordInput || !profilePicInput) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const file = profilePicInput.files[0];

    if (!username || !password || !file) {
        showNotification("Veuillez remplir tous les champs.", true);
        return;
    }

    // 📌 Lire la photo en base64 pour l'affichage local
    const reader = new FileReader();
    reader.onload = function (event) {
        let existingUsers = JSON.parse(localStorage.getItem("users")) || [];

        // 📌 Vérifier si l'utilisateur existe déjà
        const existingUser = existingUsers.find(user => user.name === username);
        if (existingUser) {
            showNotification("Ce nom est déjà utilisé. Veuillez en choisir un autre.", true);
            return;
        }

        const newUser = {
            name: username,
            password: password,
            phone: generateUserNumber(),
            profilePic: event.target.result
        };

        existingUsers.push(newUser);
        localStorage.setItem("users", JSON.stringify(existingUsers));
        localStorage.setItem("user", JSON.stringify(newUser));

        updateUserDisplay(newUser);
        showNotification("Inscription réussie !");
    };
    reader.readAsDataURL(file);

    // 📌 Envoyer les données au serveur
    const formData = new FormData();
    formData.append("profilePic", file);
    formData.append("username", username);
    formData.append("password", password);

    fetch("/upload-profile", { method: "POST", body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem("user", JSON.stringify(data.user));
                socket.emit("newUser", data.user);
                updateUserDisplay(data.user);
                document.getElementById("loginScreen").style.display = "none";
                document.getElementById("chatContainer").style.display = "flex";
                showNotification("Inscription réussie !");
            } else {
                showNotification("Erreur lors de l’upload de l’image.", true);
            }
        })
        .catch(error => console.error("Erreur lors de l’enregistrement:", error));
});

// 📌 Affichage de l'aperçu de la photo sélectionnée
document.getElementById("profilePicInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            document.getElementById("dis").style.display = "none";
            document.getElementById("profilePicPreview").style.display = "block";
            document.getElementById("profilePicPreview").src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// 📌 Indicateur "en train d'écrire"
document.getElementById("responseInput").addEventListener("input", () => {
    if (activeRecipient) {
        socket.emit("typing", { to: activeRecipient, from: username });
    }
});

socket.on("typing", ({ from }) => {
    if (from === activeRecipient) {
        const typingIndicator = document.getElementById("typingIndicator");
        typingIndicator.textContent = `${from} est en train d'écrire...`;
        typingIndicator.style.display = "block";
        setTimeout(() => {
            typingIndicator.style.display = "none";
        }, 4000);
    }
});

// 📌 Recherche des contacts en temps réel
const searchInput = document.getElementById("search-user");
if (searchInput) {
    searchInput.addEventListener("input", function () {
        const searchTerm = this.value.toLowerCase();
        document.querySelectorAll(".contact-item").forEach(contact => {
            const contactName = contact.querySelector(".contact-name")?.textContent.toLowerCase();
            contact.style.display = contactName.includes(searchTerm) ? "flex" : "none";
        });
    });
}

// 📌 Ajoute la recherche avec le bouton loupe
document.getElementById("search-button")?.addEventListener("click", () => {
    const searchTerm = searchInput.value.toLowerCase();
    document.querySelectorAll(".contact-item").forEach(contact => {
        const contactName = contact.querySelector(".contact-name")?.textContent.toLowerCase();
        contact.style.display = contactName.includes(searchTerm) ? "flex" : "none";
    });
});

















// console.log("MessageHandler.js chargé.");

// 📌 Variables globales
// const storedMessages = JSON.parse(localStorage.getItem("messages")) || {};

// 📌 Fonction pour récupérer l'utilisateur connecté depuis CloseDisplay.js
function getStoredUser() {
    return JSON.parse(localStorage.getItem("user")) || null;
}

// 📌 Mettre à jour l'affichage des messages stockés
function loadMessagesWithUser(recipient) {
    const messagesBox = document.getElementById("messages");
    messagesBox.innerHTML = "";

    if (storedMessages[recipient]) {
        storedMessages[recipient].forEach(msg => {
            addMessage(msg.text, msg.from, msg.isSent, msg.timestamp, msg.isFile);
        });
    }
}

// 📌 Sauvegarder les messages localement
function saveMessages() {
    localStorage.setItem("messages", JSON.stringify(storedMessages));
}

// 📌 Ajouter un message à l'affichage
function addMessage(content, sender, isSent, timestamp, isFile = false) {
    const messagesBox = document.getElementById("messages");
    const messageDiv = document.createElement("div");
    messageDiv.className = isSent ? "message sent" : "message received";

    if (isFile) {
        messageDiv.innerHTML = `<a href="/uploads/${content}" download class="file-link">${content}</a>`;
    } else {
        messageDiv.textContent = `${content}`;
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = ` (${new Date(timestamp).toLocaleTimeString()})`;
    messageDiv.appendChild(timeSpan);

    messagesBox.appendChild(messageDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

// 📌 Sélectionner un destinataire
function selectRecipient(user) {
    activeRecipient = user.name;
    localStorage.setItem("activeRecipient", activeRecipient);

    document.getElementById("contactselect").innerHTML = `
        <div class="selected-contact">
            <img src="/uploads/${user.profilePic}" alt="${user.name}" class="selected-contact-pic">
            <span class="selected-contact-name">${user.name}</span>
        </div>
    `;
    loadMessagesWithUser(user.name);
}

// 📌 Envoi d'un message ou fichier
function sendMessageOrFile() {
    const responseInput = document.getElementById("responseInput");
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];
    const message = responseInput.value.trim();
    const recipient = activeRecipient;

    if (!recipient) {
        showNotification("Veuillez sélectionner un destinataire.", true);
        return;
    }

    const storedUser = getStoredUser();
    if (!storedUser || !storedUser.name) {
        showNotification("Erreur : utilisateur non identifié.", true);
        return;
    }
    const sender = storedUser.name;

    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("to", recipient);
        formData.append("from", sender);

        fetch("/upload-file", { method: "POST", body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const fileObj = { from: sender, to: recipient, text: data.fileName, timestamp: Date.now(), isFile: true };
                    if (!storedMessages[recipient]) storedMessages[recipient] = [];
                    storedMessages[recipient].push(fileObj);
                    saveMessages();
                    addMessage(fileObj.text, sender, true, fileObj.timestamp, true);
                }
            });
    } else if (message) {
        const msgObj = { from: sender, to: recipient, text: message, timestamp: Date.now(), isFile: false };
        socket.emit("newMessage", msgObj);

        if (!storedMessages[recipient]) storedMessages[recipient] = [];
        storedMessages[recipient].push(msgObj);
        saveMessages();
        addMessage(msgObj.text, sender, true, msgObj.timestamp);
        responseInput.value = "";
    }
}

// 📌 Recevoir un message
socket.on("receiveMessage", (msg) => {
    if (!storedMessages[msg.from]) storedMessages[msg.from] = [];
    storedMessages[msg.from].push(msg);
    saveMessages();

    if (msg.from === activeRecipient) {
        addMessage(msg.text, msg.from, false, msg.timestamp);
    }
    showNotification(`Nouveau message de ${msg.from}`);

    // 📌 Charger les nouveaux messages immédiatement
    loadMessagesWithUser(activeRecipient);
});

// 📌 Recevoir un fichier
socket.on("receiveFile", (file) => {
    if (!storedMessages[file.from]) storedMessages[file.from] = [];
    storedMessages[file.from].push(file);
    saveMessages();

    if (file.from === activeRecipient) {
        addMessage(file.fileName, file.from, false, file.timestamp, true);
    }
    showNotification(`Nouveau fichier de ${file.from}`);

    // 📌 Charger les nouveaux fichiers immédiatement
    loadMessagesWithUser(activeRecipient);
});

// 📌 Envoi avec la touche Entrée
document.getElementById("responseInput").addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessageOrFile();
    }
});
