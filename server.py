import hashlib
import json
import os
import re
import secrets
import sqlite3
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
USERS_FILE = BASE_DIR / "users.json"
SQL_FILE = BASE_DIR / "library-inventory-management-1780786998527.sql"
DB_FILE = BASE_DIR / "library.db"


def load_users():
    if not USERS_FILE.exists():
        return []
    try:
        with USERS_FILE.open("r", encoding="utf-8") as users_file:
            return json.load(users_file)
    except (json.JSONDecodeError, OSError):
        return []


def save_users(users):
    with USERS_FILE.open("w", encoding="utf-8") as users_file:
        json.dump(users, users_file, indent=2, ensure_ascii=False)


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    password_bytes = password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    hashed = hashlib.pbkdf2_hmac("sha256", password_bytes, salt_bytes, 120_000)
    return salt, hashed.hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    _, hashed = hash_password(password, salt)
    return secrets.compare_digest(hashed, expected_hash)


def parse_sql_tables():
    if not SQL_FILE.exists():
        return []

    text = SQL_FILE.read_text(encoding="utf-8", errors="ignore")
    regex = re.compile(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\(\s]+)", re.IGNORECASE)
    tables = []
    for match in regex.finditer(text):
        table_name = match.group(1).strip().strip('"`')
        if table_name and table_name not in tables:
            tables.append(table_name)
    return tables


def ensure_database():
    sql_text = ""
    if SQL_FILE.exists():
        sql_text = SQL_FILE.read_text(encoding="utf-8", errors="ignore")

    if not DB_FILE.exists():
        conn = sqlite3.connect(DB_FILE)
        try:
            if sql_text:
                conn.executescript(sql_text)
            conn.commit()
        finally:
            conn.close()
        return

    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    try:
        if sql_text:
            conn.executescript(sql_text)
            conn.commit()

        columns = [row[1] for row in conn.execute("PRAGMA table_info(libros)").fetchall()]
        if "isbn" in columns:
            conn.execute("PRAGMA foreign_keys = OFF")
            conn.execute("DROP TABLE IF EXISTS libros_new")
            conn.execute(
                "CREATE TABLE libros_new ("
                "id INTEGER PRIMARY KEY, "
                "titulo VARCHAR(255) NOT NULL, "
                "autor VARCHAR(255) NOT NULL, "
                "genero VARCHAR(100), "
                "fecha_publicacion DATE, "
                "cantidad_disponible INTEGER DEFAULT 0, "
                "autor_id INTEGER, "
                "FOREIGN KEY (autor_id) REFERENCES autores(id)"
                ")"
            )
            conn.execute(
                "INSERT INTO libros_new (id, titulo, autor, genero, fecha_publicacion, cantidad_disponible, autor_id) "
                "SELECT id, titulo, autor, genero, fecha_publicacion, cantidad_disponible, autor_id FROM libros"
            )
            conn.execute("DROP TABLE libros")
            conn.execute("ALTER TABLE libros_new RENAME TO libros")
            conn.execute("PRAGMA foreign_keys = ON")
            conn.commit()
    finally:
        conn.close()


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def log_admin_session(username, email):
    ensure_database()
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO personal_administrativo (nombre, puesto, fecha_contratacion, telefono, email) VALUES (?, ?, ?, ?, ?)",
            (username, "Administrador", datetime.utcnow().date().isoformat(), None, email)
        )
        conn.commit()
    finally:
        conn.close()


class RequestHandler(SimpleHTTPRequestHandler):
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def parse_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body)

    def do_POST(self):
        if self.path == "/register":
            self.handle_register()
        elif self.path == "/login":
            self.handle_login()
        elif self.path == "/books":
            self.handle_create_book()
        else:
            self.send_error(404, "Not Found")

    def do_GET(self):
        if self.path == "/tables":
            self.handle_tables()
        elif self.path == "/books":
            self.handle_books_list()
        else:
            return super().do_GET()

    def do_PUT(self):
        if self.path.startswith("/books/"):
            self.handle_update_book()
        else:
            self.send_error(404, "Not Found")

    def do_DELETE(self):
        if self.path.startswith("/books/"):
            self.handle_delete_book()
        else:
            self.send_error(404, "Not Found")

    def handle_register(self):
        try:
            data = self.parse_json_body()
        except json.JSONDecodeError:
            self.send_json({"success": False, "message": "JSON inválido."}, status=400)
            return

        username = data.get("username", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")

        if not username or not email or not password or not confirm_password:
            self.send_json({"success": False, "message": "Todos los campos son obligatorios."}, status=400)
            return

        if password != confirm_password:
            self.send_json({"success": False, "message": "Las contraseñas no coinciden."}, status=400)
            return

        users = load_users()
        if any(user.get("email") == email for user in users):
            self.send_json({"success": False, "message": "Ya existe una cuenta con ese correo."}, status=400)
            return

        salt, password_hash = hash_password(password)
        user_record = {
            "id": secrets.token_hex(8),
            "username": username,
            "email": email,
            "password_hash": password_hash,
            "salt": salt,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }
        users.append(user_record)
        save_users(users)
        self.send_json({"success": True, "message": "Cuenta creada correctamente."})

    def handle_login(self):
        try:
            data = self.parse_json_body()
        except json.JSONDecodeError:
            self.send_json({"success": False, "message": "JSON inválido."}, status=400)
            return

        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            self.send_json({"success": False, "message": "Correo y contraseña son obligatorios."}, status=400)
            return

        users = load_users()
        user = next((user for user in users if user.get("email") == email), None)
        if user is None or not verify_password(password, user.get("salt", ""), user.get("password_hash", "")):
            self.send_json({"success": False, "message": "Correo o contraseña incorrectos."}, status=401)
            return

        log_admin_session(user.get("username"), email)
        self.send_json({"success": True, "message": f"Bienvenido, {user.get('username')}!"})

    def handle_books_list(self):
        if not DB_FILE.exists():
            self.send_json({"success": True, "books": []})
            return
        conn = get_db_connection()
        try:
            rows = conn.execute(
                "SELECT id, titulo, autor, genero, fecha_publicacion, cantidad_disponible FROM libros ORDER BY id"
            ).fetchall()
            books = [dict(row) for row in rows]
            self.send_json({"success": True, "books": books})
        finally:
            conn.close()

    def handle_create_book(self):
        try:
            data = self.parse_json_body()
        except json.JSONDecodeError:
            self.send_json({"success": False, "message": "JSON inválido."}, status=400)
            return

        titulo = data.get("titulo", "").strip()
        autor = data.get("autor", "").strip()
        genero = data.get("genero", "").strip()
        fecha_publicacion = data.get("fecha_publicacion")
        cantidad_disponible = data.get("cantidad_disponible")

        if not titulo or not autor:
            self.send_json({"success": False, "message": "Título y autor son obligatorios."}, status=400)
            return

        try:
            cantidad_disponible = int(cantidad_disponible or 0)
        except (TypeError, ValueError):
            cantidad_disponible = 0

        ensure_database()
        conn = get_db_connection()
        try:
            cursor = conn.execute(
                "INSERT INTO libros (titulo, autor, genero, fecha_publicacion, cantidad_disponible) VALUES (?, ?, ?, ?, ?)",
                (titulo, autor, genero or None, fecha_publicacion or None, cantidad_disponible)
            )
            conn.commit()
            self.send_json({"success": True, "message": "Libro agregado correctamente.", "book_id": cursor.lastrowid})
        except sqlite3.IntegrityError as error:
            self.send_json({"success": False, "message": str(error)}, status=400)
        finally:
            conn.close()

    def handle_update_book(self):
        book_id = self.path.split("/", 2)[-1]
        if not book_id.isdigit():
            self.send_json({"success": False, "message": "ID de libro inválido."}, status=400)
            return

        try:
            data = self.parse_json_body()
        except json.JSONDecodeError:
            self.send_json({"success": False, "message": "JSON inválido."}, status=400)
            return

        titulo = data.get("titulo", "").strip()
        autor = data.get("autor", "").strip()
        genero = data.get("genero", "").strip()
        fecha_publicacion = data.get("fecha_publicacion")
        cantidad_disponible = data.get("cantidad_disponible")

        if not titulo or not autor:
            self.send_json({"success": False, "message": "Título y autor son obligatorios."}, status=400)
            return

        try:
            cantidad_disponible = int(cantidad_disponible or 0)
        except (TypeError, ValueError):
            cantidad_disponible = 0

        ensure_database()
        conn = get_db_connection()
        try:
            cursor = conn.execute(
                "UPDATE libros SET titulo = ?, autor = ?, genero = ?, fecha_publicacion = ?, cantidad_disponible = ? WHERE id = ?",
                (titulo, autor, genero or None, fecha_publicacion or None, cantidad_disponible, int(book_id))
            )
            conn.commit()
            if cursor.rowcount == 0:
                self.send_json({"success": False, "message": "Libro no encontrado."}, status=404)
                return
            self.send_json({"success": True, "message": "Libro actualizado correctamente."})
        except sqlite3.IntegrityError as error:
            self.send_json({"success": False, "message": str(error)}, status=400)
        finally:
            conn.close()

    def handle_delete_book(self):
        book_id = self.path.split("/", 2)[-1]
        if not book_id.isdigit():
            self.send_json({"success": False, "message": "ID de libro inválido."}, status=400)
            return

        ensure_database()
        conn = get_db_connection()
        try:
            cursor = conn.execute("DELETE FROM libros WHERE id = ?", (int(book_id),))
            conn.commit()
            if cursor.rowcount == 0:
                self.send_json({"success": False, "message": "Libro no encontrado."}, status=404)
                return
            self.send_json({"success": True, "message": "Libro eliminado correctamente."})
        finally:
            conn.close()

    def handle_tables(self):
        tables = parse_sql_tables()
        self.send_json({"success": True, "tables": tables})


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    port = 8000
    server_address = ("", port)
    with ThreadingHTTPServer(server_address, RequestHandler) as httpd:
        print(f"Servidor iniciado en http://localhost:{port}")
        httpd.serve_forever()
