document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");
    const showLoginLink = document.getElementById("showLogin");
    const showRegisterLink = document.getElementById("showRegister");
    const registerMessage = document.getElementById("registerMessage");
    const loginMessage = document.getElementById("loginMessage");
    const registerBtn = document.getElementById("registerBtn");
    const loginBtn = document.getElementById("loginBtn");

    const showMessage = (element, text, type = "error") => {
        element.textContent = text;
        element.className = `message ${type}`;
    };

    const showForm = (formToShow) => {
        registerForm.classList.toggle("hidden", formToShow !== registerForm);
        loginForm.classList.toggle("hidden", formToShow !== loginForm);
        showMessage(registerMessage, "", "");
        showMessage(loginMessage, "", "");
    };

    showLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        showForm(loginForm);
    });

    showRegisterLink.addEventListener("click", (e) => {
        e.preventDefault();
        showForm(registerForm);
    });

    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!username || !email || !password || !confirmPassword) {
            showMessage(registerMessage, "Por favor completa todos los campos.");
            return;
        }

        if (password !== confirmPassword) {
            showMessage(registerMessage, "Las contraseñas no coinciden.");
            return;
        }

        registerBtn.textContent = "Creando cuenta...";
        registerBtn.disabled = true;
        showMessage(registerMessage, "", "");

        try {
            const response = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    confirm_password: confirmPassword
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showMessage(registerMessage, result.message || "Cuenta creada correctamente.", "success");
                registerForm.reset();
            } else {
                showMessage(registerMessage, result.message || "Ocurrió un error al crear la cuenta.");
            }
        } catch (error) {
            showMessage(registerMessage, "No se pudo conectar con el servidor.");
        } finally {
            registerBtn.textContent = "Crear cuenta";
            registerBtn.disabled = false;
        }
    });

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        if (!email || !password) {
            showMessage(loginMessage, "Por favor completa todos los campos.");
            return;
        }

        loginBtn.textContent = "Ingresando...";
        loginBtn.disabled = true;
        showMessage(loginMessage, "", "");

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showMessage(loginMessage, result.message || "Bienvenido.", "success");
                loginForm.reset();
            } else {
                showMessage(loginMessage, result.message || "Correo o contraseña incorrectos.");
            }
        } catch (error) {
            showMessage(loginMessage, "No se pudo conectar con el servidor.");
        } finally {
            loginBtn.textContent = "Entrar";
            loginBtn.disabled = false;
        }
    });
});
