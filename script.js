document.addEventListener("DOMContentLoaded", () => {
    console.log("BSD Login app loaded", { href: location.href, protocol: location.protocol, host: location.host });
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");
    const loginBox = document.querySelector(".login-box");
    const showLoginLink = document.getElementById("showLogin");
    const showRegisterLink = document.getElementById("showRegister");
    const registerMessage = document.getElementById("registerMessage");
    const loginMessage = document.getElementById("loginMessage");
    const registerBtn = document.getElementById("registerBtn");
    const loginBtn = document.getElementById("loginBtn");
    const booksPanel = document.getElementById("booksPanel");
    const bookForm = document.getElementById("bookForm");
    const bookIdInput = document.getElementById("bookId");
    const bookTitleInput = document.getElementById("bookTitle");
    const bookAuthorInput = document.getElementById("bookAuthor");
    const bookGenreInput = document.getElementById("bookGenre");
    const bookDateInput = document.getElementById("bookDate");
    const bookQuantityInput = document.getElementById("bookQuantity");
    const bookSubmitBtn = document.getElementById("bookSubmitBtn");
    const cancelEditBtn = document.getElementById("cancelEditBtn");
    const booksTableBody = document.querySelector("#booksTable tbody");
    const bookMessage = document.getElementById("bookMessage");
    const logoutBtn = document.getElementById("logoutBtn");
    const welcomeText = document.getElementById("welcomeText");
    const scrollUpBtn = document.getElementById("scrollUp");
    const scrollDownBtn = document.getElementById("scrollDown");

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

    const toggleBooksPanel = (show) => {
        if (booksPanel) {
            booksPanel.classList.toggle("hidden", !show);
        }
    };

    const fetchJSON = async (path, options = {}) => {
        try {
            const headers = {
                "Content-Type": "application/json",
                ...(options.headers || {})
            };
            const requestOptions = { ...options, headers };
            if (options.body && typeof options.body === "object") {
                requestOptions.body = JSON.stringify(options.body);
            }
            const response = await fetch(path, requestOptions);
            const result = await response.json();
            if (!response.ok) {
                return { success: false, message: result?.message || `Error ${response.status}` };
            }
            return result;
        } catch (error) {
            return { success: false, message: error?.message || "No se pudo conectar con el servidor." };
        }
    };

    const clearBookForm = () => {
        bookIdInput.value = "";
        bookTitleInput.value = "";
        bookAuthorInput.value = "";
        bookGenreInput.value = "";
        bookDateInput.value = "";
        bookQuantityInput.value = "0";
        bookSubmitBtn.textContent = "Agregar libro";
        cancelEditBtn.classList.add("hidden");
        showMessage(bookMessage, "", "");
    };

    const renderBooks = (books) => {
        if (!books || !books.length) {
            booksTableBody.innerHTML = "<tr><td colspan='7'>No hay libros registrados.</td></tr>";
            return;
        }

        booksTableBody.innerHTML = "";
        books.forEach((book) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${book.id}</td>
                <td>${book.titulo || ""}</td>
                <td>${book.autor || ""}</td>
                <td>${book.genero || ""}</td>
                <td>${book.fecha_publicacion || ""}</td>
                <td>${book.cantidad_disponible ?? 0}</td>
                <td>
                    <button type="button" class="edit-btn" data-book-id="${book.id}">Editar</button>
                    <button type="button" class="delete-btn" data-book-id="${book.id}">Eliminar</button>
                </td>
            `;
            booksTableBody.appendChild(row);
        });

        booksTableBody.querySelectorAll(".edit-btn").forEach((button) => {
            button.addEventListener("click", () => {
                const bookId = button.dataset.bookId;
                const book = books.find((item) => String(item.id) === String(bookId));
                if (book) {
                    bookIdInput.value = book.id;
                    bookTitleInput.value = book.titulo || "";
                    bookAuthorInput.value = book.autor || "";
                    bookGenreInput.value = book.genero || "";
                    bookDateInput.value = book.fecha_publicacion || "";
                    bookQuantityInput.value = book.cantidad_disponible ?? 0;
                    bookSubmitBtn.textContent = "Actualizar libro";
                    cancelEditBtn.classList.remove("hidden");
                }
            });
        });

        booksTableBody.querySelectorAll(".delete-btn").forEach((button) => {
            button.addEventListener("click", async () => {
                const bookId = button.dataset.bookId;
                if (!bookId) {
                    return;
                }
                if (!confirm("¿Eliminar este libro?")) {
                    return;
                }
                const result = await fetchJSON(`/books/${bookId}`, { method: "DELETE" });
                if (result.success) {
                    showMessage(bookMessage, result.message || "Libro eliminado.", "success");
                    await loadBooks();
                    clearBookForm();
                } else {
                    showMessage(bookMessage, result.message || "No se pudo eliminar el libro.", "error");
                }
            });
        });
    };

    const loadBooks = async () => {
        showMessage(bookMessage, "", "");
        if (!isHttpServer) {
            booksTableBody.innerHTML = "<tr><td colspan='8'>La gestión de libros funciona solo cuando se usa un servidor HTTP.</td></tr>";
            return;
        }

        const result = await fetchJSON("/books");
        if (!result.success) {
            booksTableBody.innerHTML = `<tr><td colspan='8'>${result.message || "No se pudieron cargar los libros."}</td></tr>`;
            return;
        }
        renderBooks(result.books || []);
    };

    const handleBookFormSubmit = async (e) => {
        e.preventDefault();
        const titulo = bookTitleInput.value.trim();
        const autor = bookAuthorInput.value.trim();
        const genero = bookGenreInput.value.trim();
        const fecha_publicacion = bookDateInput.value || null;
        const cantidad_disponible = parseInt(bookQuantityInput.value, 10) || 0;

        if (!titulo || !autor) {
            showMessage(bookMessage, "Título y autor son obligatorios.", "error");
            return;
        }

        const payload = { titulo, autor, genero, fecha_publicacion, cantidad_disponible };
        const isEditing = Boolean(bookIdInput.value);
        const path = isEditing ? `/books/${bookIdInput.value}` : "/books";
        const method = isEditing ? "PUT" : "POST";

        const result = await fetchJSON(path, { method, body: payload });
        if (result.success) {
            showMessage(bookMessage, result.message || (isEditing ? "Libro actualizado." : "Libro agregado."), "success");
            clearBookForm();
            await loadBooks();
        } else {
            showMessage(bookMessage, result.message || "No se pudo guardar el libro.", "error");
        }
    };

    const cancelBookEdit = () => {
        clearBookForm();
    };

    const normalizeEmail = (email) => {
        if (typeof email !== "string") {
            return "";
        }
        return email.trim().toLowerCase();
    };

    const normalizeUser = (user) => {
        if (typeof user !== "object" || user === null) {
            return { username: "", email: "", password_hash: "", created_at: "" };
        }
        const rawEmail = user.email ?? user.Email ?? user.EMail ?? user.mail ?? "";
        const rawUsername = user.username ?? user.userName ?? user.Username ?? user.name ?? "";
        const rawHash = user.password_hash ?? user.passwordHash ?? user.password ?? "";
        const rawCreatedAt = user.created_at ?? user.createdAt ?? new Date().toISOString();
        return {
            username: String(rawUsername).trim(),
            email: normalizeEmail(rawEmail),
            password_hash: String(rawHash),
            created_at: String(rawCreatedAt)
        };
    };

    const getLocalUsers = () => {
        const raw = localStorage.getItem("bsd_local_users");
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                localStorage.removeItem("bsd_local_users");
                return [];
            }
            return parsed.map(normalizeUser);
        } catch {
            localStorage.removeItem("bsd_local_users");
            return [];
        }
    };

    const saveLocalUsers = (users) => {
        const normalized = Array.isArray(users)
            ? users.map((user) => normalizeUser(user))
            : [];
        localStorage.setItem("bsd_local_users", JSON.stringify(normalized));
    };

    const hashText = async (text) => {
        const data = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    };

    const localRegister = async ({ username, email, password }) => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return { success: false, message: "Correo inválido." };
        }

        const users = getLocalUsers();
        if (users.some((user) => user.email === normalizedEmail)) {
            return { success: false, message: "Ya existe una cuenta con ese correo." };
        }

        const password_hash = await hashText(password);
        users.push({
            username: String(username).trim(),
            email: normalizedEmail,
            password_hash,
            created_at: new Date().toISOString()
        });
        saveLocalUsers(users);
        return { success: true, message: "Cuenta creada localmente." };
    };

    const localLogin = async ({ email, password }) => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return { success: false, message: "No existe una cuenta con ese correo." };
        }

        const users = getLocalUsers();
        const user = users.find((user) => user.email === normalizedEmail);
        if (!user) {
            return { success: false, message: "No existe una cuenta con ese correo." };
        }

        const password_hash = await hashText(password);
        if (user.password_hash !== password_hash) {
            return { success: false, message: "Contraseña incorrecta." };
        }
        return { success: true, message: `Bienvenido, ${user.username}.` };
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
            document.body.classList.add("logged-in");
            loginBox?.classList.add("logged-in");
            registerForm.classList.add("hidden");
            loginForm.classList.add("hidden");
            toggleBooksPanel(true);
            logoutBtn.classList.remove("hidden");
            welcomeText.textContent = `Sesión iniciada como ${session.username || session.email}`;
            await loadBooks();
            return;
        }

        document.body.classList.remove("logged-in");
        loginBox?.classList.remove("logged-in");
        logoutBtn.classList.add("hidden");
        welcomeText.textContent = "Sesión iniciada";
        toggleBooksPanel(false);
        showForm(loginForm);
    };

    const submitAuthForm = async (path, payload, messageElement, button) => {
        console.log("submitAuthForm", { path, payload });
        button.disabled = true;
        showMessage(messageElement, "", "");

        const localFallback = async () => {
            if (path === "/register") {
                return await localRegister(payload);
            }
            if (path === "/login") {
                return await localLogin(payload);
            }
            return { success: false, message: "No se puede usar este endpoint localmente." };
        };

        if (!isHttpServer) {
            console.warn("submitAuthForm: no HTTP server available, using local fallback");
            const fallback = await localFallback();
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
            const contentType = response.headers.get("Content-Type") || "";
            let result = { success: false, message: "Ocurrió un error." };

            if (contentType.includes("application/json")) {
                result = await response.json();
            }

            if (response.ok && result.success) {
                showMessage(messageElement, result.message || "Operación completada.", "success");
                return true;
            }

            if (path === "/login" && [404, 405].includes(response.status)) {
                console.warn("submitAuthForm server auth endpoint not available, trying local login fallback", response.status);
                const fallback = await localFallback();
                showMessage(messageElement, fallback.message || "No se pudo procesar localmente.", fallback.success ? "success" : "error");
                return fallback.success;
            }

            if ([404, 405, 0].includes(response.status)) {
                console.warn("submitAuthForm server endpoint no disponible, using local fallback", response.status);
                const fallback = await localFallback();
                showMessage(messageElement, fallback.message || "No se pudo conectar con el servidor.", fallback.success ? "success" : "error");
                return fallback.success;
            }

            showMessage(messageElement, result.message || "Ocurrió un error.", "error");
            return false;
        } catch (error) {
            console.warn("submitAuthForm fetch failed, using local fallback", error);
            const fallback = await localFallback();
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
        clearBookForm();
        showMessage(loginMessage, "", "");
        showMessage(registerMessage, "", "");
        showMessage(bookMessage, "", "");
        booksTableBody.innerHTML = "";
        toggleBooksPanel(false);
        document.body.classList.remove("logged-in");
        loginBox?.classList.remove("logged-in");
        showForm(loginForm);
    });

    bookForm.addEventListener("submit", handleBookFormSubmit);

    if (scrollUpBtn) {
        scrollUpBtn.addEventListener("click", () => {
            window.scrollBy({ top: -window.innerHeight, left: 0, behavior: "smooth" });
        });
    }

    if (scrollDownBtn) {
        scrollDownBtn.addEventListener("click", () => {
            window.scrollBy({ top: window.innerHeight, left: 0, behavior: "smooth" });
        });
    }
    cancelEditBtn.addEventListener("click", cancelBookEdit);

    updateSessionUI();
});
