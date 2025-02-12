console.log("MessageHandler.js chargé.");

// 📌 Variables globales
const storedMessages = JSON.parse(localStorage.getItem("messages")) || {};
let activeRecipient = null;

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
