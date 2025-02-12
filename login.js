document.addEventListener("DOMContentLoaded", () => {
    const startChatButton = document.getElementById("startChatButton");
    const profilePicInput = document.getElementById("profilePicInput");
    const profilePicPreview = document.getElementById("profilePicPreview");
    const usernameInput = document.getElementById("usernameInput");
    const passwordInput = document.getElementById("password");
    const notificationDiv = document.getElementById("notification");

    // 📌 Fonction pour afficher une notification
    function showNotification(message, isError = false) {
        notificationDiv.textContent = message;
        notificationDiv.className = isError ? "notification error" : "notification";
        notificationDiv.style.display = "block";
        setTimeout(() => {
            notificationDiv.style.display = "none";
        }, 3000);
    }

    // 📌 Affiche l'aperçu de la photo de profil
    profilePicInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                document.getElementById("dis").style.display = "none";
                profilePicPreview.style.display = "block";
                profilePicPreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // 📌 Génération d'un numéro unique (5 chiffres)
    function generateUserNumber() {
        return Math.floor(10000 + Math.random() * 90000);
    }

    // 📌 Gestion de l'inscription
    startChatButton.addEventListener("click", (e) => {
        e.preventDefault(); // Empêche le rechargement de la page

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const file = profilePicInput.files[0];

        if (!username || !password || !file) {
            showNotification("Veuillez remplir tous les champs.", true);
            return;
        }

        // 📌 Lire la photo en base64 pour l'afficher et vérifier l'unicité du nom
        const reader = new FileReader();
        reader.onload = function (event) {
            let existingUsers = JSON.parse(localStorage.getItem("users")) || [];

            // 📌 Vérifier si le nom est déjà utilisé
            if (existingUsers.some(user => user.name === username)) {
                showNotification("Ce nom est déjà utilisé. Veuillez en choisir un autre.", true);
                return;
            }

            // 📌 Création du nouvel utilisateur
            const newUser = {
                name: username,
                password: password,
                phone: generateUserNumber(), // Génération d'un numéro unique
                profilePic: event.target.result // Enregistrer l'image en base64
            };

            // 📌 Stocker les informations localement
            existingUsers.push(newUser);
            localStorage.setItem("users", JSON.stringify(existingUsers));
            localStorage.setItem("user", JSON.stringify(newUser));

            // 📌 Envoyer les informations au serveur
            const formData = new FormData();
            formData.append("profilePic", file);
            formData.append("username", username);
            formData.append("password", password);

            fetch("/upload-profile", { method: "POST", body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        localStorage.setItem("user", JSON.stringify(data.user));
                        showNotification("Inscription reussie. Redirection en cours...", false);

                        // 📌 Redirection vers `index-next.html` après l'inscription
                        window.location.href = "index-next.html";
                    } else {
                        showNotification("Erreur lors de l'upload de l'image.", true);
                    }
                })
                .catch(error => console.error("Erreur lors de l’enregistrement :", error));
        };

        reader.readAsDataURL(file);
    });
});
