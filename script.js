document.addEventListener("DOMContentLoaded", () => {
    console.log("BSD Login app loaded", { href: location.href, protocol: location.protocol, host: location.host });
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");
    const showLoginLink = document.getElementById("showLogin");
    const showRegisterLink = document.getElementById("showRegister");
    const registerMessage = document.getElementById("registerMessage");
    const loginMessage = document.getElementById("loginMessage");
    const registerBtn = document.getElementById("registerBtn");
    const loginBtn = document.getElementById("loginBtn");
    const tablesPanel = document.getElementById("tablesPanel");
    const tablesContainer = document.getElementById("tablesContainer");
    const tablesMessage = document.getElementById("tablesMessage");
    const logoutBtn = document.getElementById("logoutBtn");
    const welcomeText = document.getElementById("welcomeText");

    const isHttpServer = location.protocol === "http:" || location.protocol === "https:";
    if (!isHttpServer) {
        console.warn("No se está cargando desde un servidor HTTP; algunos recursos pueden fallar.");
    }

    const showMessage = (element, text, type = "") => {
        element.textContent = text;
        element.className = `message ${type}`.trim();
    };

    const showForm = (formToShow) => {
        registerForm.classList.toggle("hidden", formToShow !== registerForm);
        loginForm.classList.toggle("hidden", formToShow !== loginForm);
        showMessage(registerMessage, "", "");
        showMessage(loginMessage, "", "");
    };

    const toggleTablesPanel = (show) => {
        tablesPanel.classList.toggle("hidden", !show);
    };

    const getLocalUsers = () => {
        const raw = localStorage.getItem("bsd_local_users");
        try {
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    };

    const saveLocalUsers = (users) => {
        localStorage.setItem("bsd_local_users", JSON.stringify(users));
    };

    const hashText = async (text) => {
        const data = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    };

    const localRegister = async ({ username, email, password }) => {
        const users = getLocalUsers();
        if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
            return { success: false, message: "Ya existe una cuenta con ese correo." };
        }

        const password_hash = await hashText(password);
        users.push({
            username,
            email: email.toLowerCase(),
            password_hash,
            created_at: new Date().toISOString()
        });
        saveLocalUsers(users);
        return { success: true, message: "Cuenta creada localmente." };
    };

    const localLogin = async ({ email, password }) => {
        const users = getLocalUsers();
        const user = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
        if (!user) {
            return { success: false, message: "No existe una cuenta con ese correo." };
        }

        const password_hash = await hashText(password);
        if (user.password_hash !== password_hash) {
            return { success: false, message: "Contraseña incorrecta." };
        }
        return { success: true, message: `Bienvenido, ${user.username}.` };
    };

    const parseSQLTables = (sqlText) => {
        const tables = new Set();
        const regex = /CREATE\s+TABLE\s+([^\(\s]+)/gi;
        let match;
        while ((match = regex.exec(sqlText)) !== null) {
            const rawName = match[1].trim().replace(/['"`]/g, "");
            if (rawName) {
                tables.add(rawName);
            }
        }
        return Array.from(tables);
    };

    const renderTables = (tables) => {
        if (!tables.length) {
            tablesContainer.textContent = "No se encontraron tablas en el archivo SQL.";
            return;
        }

        tablesContainer.innerHTML = "";
        tables.forEach((table) => {
            const item = document.createElement("div");
            item.className = "table-item";
            item.textContent = table;
            tablesContainer.appendChild(item);
        });
    };

    const loadTableList = async () => {
        console.log("loadTableList: requesting tables from /tables");
        tablesContainer.textContent = "";

        if (isHttpServer) {
            try {
                const response = await fetch("/tables");
                console.log("loadTableList: /tables response status", response.status);
                if (response.ok) {
                    const result = await response.json();
                    console.log("loadTableList: /tables result", result);
                    if (result.success) {
                        renderTables(result.tables || []);
                        return;
                    }
                }
            } catch (error) {
                console.warn("loadTableList: /tables fetch failed", error);
            }
        } else {
            console.warn("loadTableList: no HTTP server available, skipping /tables");
        }

        try {
            console.log("loadTableList: fetching local SQL file");
            const response = await fetch("library-inventory-management-1780786998527.sql");
            console.log("loadTableList: SQL response status", response.status);
            if (!response.ok) {
                throw new Error("No se encontró el archivo SQL.");
            }
            const sqlText = await response.text();
            renderTables(parseSQLTables(sqlText));
        } catch (error) {
            console.error("loadTableList: failed to load tables", error);
            showMessage(tablesMessage, `No se pudo cargar la lista de tablas. ${error.message}`, "error");
            tablesContainer.textContent = "No se pudo mostrar las tablas.";
        }
    };

    const getSession = () => {
        const raw = localStorage.getItem("bsd_session");
        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch {
            localStorage.removeItem("bsd_session");
            return null;
        }
    };

    const saveSession = (session) => {
        localStorage.setItem("bsd_session", JSON.stringify(session));
    };

    const clearSession = () => {
        localStorage.removeItem("bsd_session");
    };

    const updateSessionUI = async () => {
        const session = getSession();
        const loggedIn = Boolean(session && session.email);

        if (loggedIn) {
            registerForm.classList.add("hidden");
            loginForm.classList.add("hidden");
            logoutBtn.classList.remove("hidden");
            welcomeText.textContent = `Sesión iniciada como ${session.username || session.email}`;
            await showTablesPanel();
            return;
        }

        logoutBtn.classList.add("hidden");
        welcomeText.textContent = "Sesión iniciada";
        showForm(loginForm);
    };

    const showTablesPanel = async () => {
        toggleTablesPanel(true);
        tablesContainer.textContent = "Cargando tablas...";
        showMessage(tablesMessage, "", "");
        await loadTableList();
    };

    const submitAuthForm = async (path, payload, messageElement, button) => {
        console.log("submitAuthForm", { path, payload });
        button.disabled = true;
        showMessage(messageElement, "", "");

        if (!isHttpServer) {
            console.warn("submitAuthForm: no HTTP server available, using local fallback");
            const fallback = path === "/register"
                ? await localRegister(payload)
                : path === "/login"
                    ? await localLogin(payload)
                    : { success: false, message: "No se puede usar este endpoint localmente." };
            showMessage(messageElement, fallback.message || "No se pudo procesar localmente.", fallback.success ? "success" : "error");
            button.disabled = false;
            return fallback.success;
        }

        try {
            const response = await fetch(path, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            console.log("submitAuthForm response status", response.status);
            const result = await response.json();
            console.log("submitAuthForm result", result);
            if (response.ok && result.success) {
                showMessage(messageElement, result.message || "Operación completada.", "success");
                return true;
            }

            showMessage(messageElement, result.message || "Ocurrió un error.", "error");
            return false;
        } catch (error) {
            console.warn("submitAuthForm fetch failed, using local fallback", error);
            const fallback = path === "/register"
                ? await localRegister(payload)
                : path === "/login"
                    ? await localLogin(payload)
                    : { success: false, message: "No se pudo conectar con el servidor." };

            showMessage(messageElement, fallback.message || "No se pudo conectar con el servidor.", fallback.success ? "success" : "error");
            return fallback.success;
        } finally {
            button.disabled = false;
        }
    };

    showLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        showForm(loginForm);
    });

    showRegisterLink.addEventListener("click", (e) => {
        e.preventDefault();
        showForm(registerForm);
    });

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!username || !email || !password || !confirmPassword) {
            showMessage(registerMessage, "Por favor completa todos los campos.", "error");
            return;
        }

        if (password !== confirmPassword) {
            showMessage(registerMessage, "Las contraseñas no coinciden.", "error");
            return;
        }

        registerBtn.textContent = "Creando cuenta...";
        const success = await submitAuthForm(
            "/register",
            { username, email, password, confirm_password: confirmPassword },
            registerMessage,
            registerBtn
        );

        if (success) {
            saveSession({
                email: email.toLowerCase(),
                username,
                created_at: new Date().toISOString()
            });
            registerForm.reset();
            await updateSessionUI();
        }
        registerBtn.textContent = "Crear cuenta";
    });

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        if (!email || !password) {
            showMessage(loginMessage, "Por favor completa todos los campos.", "error");
            return;
        }

        loginBtn.textContent = "Ingresando...";
        const success = await submitAuthForm(
            "/login",
            { email, password },
            loginMessage,
            loginBtn
        );

        if (success) {
            let username = email;
            const user = getLocalUsers().find((user) => user.email.toLowerCase() === email.toLowerCase());
            if (user) {
                username = user.username;
            }

            saveSession({
                email: email.toLowerCase(),
                username,
                created_at: new Date().toISOString()
            });
            loginForm.reset();
            await updateSessionUI();
        }
        loginBtn.textContent = "Entrar";
    });

    logoutBtn.addEventListener("click", () => {
        clearSession();
        showMessage(loginMessage, "", "");
        showMessage(registerMessage, "", "");
        tablesMessage.textContent = "";
        tablesContainer.textContent = "Inicia sesión o crea una cuenta para ver las tablas.";
        showForm(loginForm);
    });

    updateSessionUI();
});
