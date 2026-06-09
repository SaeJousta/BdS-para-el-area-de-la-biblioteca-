document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    const submitBtn = document.getElementById("submitBtn");
    const message = document.getElementById("message");

    const showMessage = (text, type = "error") => {
        message.textContent = text;
        message.className = `message ${type}`;
    };

    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!username || !email || !password || !confirmPassword) {
            showMessage("Por favor completa todos los campos.");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Las contraseñas no coinciden.");
            return;
        }

        submitBtn.textContent = "Creando cuenta...";
        submitBtn.disabled = true;
        showMessage("", "");

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
                showMessage(result.message || "Cuenta creada correctamente.", "success");
                registerForm.reset();
            } else {
                showMessage(result.message || "Ocurrió un error al crear la cuenta.");
            }
        } catch (error) {
            showMessage("No se pudo conectar con el servidor.");
        } finally {
            submitBtn.textContent = "Crear cuenta";
            submitBtn.disabled = false;
        }
    });
});
