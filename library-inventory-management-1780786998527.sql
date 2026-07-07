-- Standard SQL schema for library inventory
CREATE TABLE IF NOT EXISTS autores (
    id INTEGER PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    nacionalidad VARCHAR(255),
    fecha_nacimiento DATE
);

CREATE TABLE IF NOT EXISTS libros (
    id INTEGER PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    autor VARCHAR(255) NOT NULL,
    genero VARCHAR(100),
    fecha_publicacion DATE,
    cantidad_disponible INTEGER DEFAULT 0,
    autor_id INTEGER,
    FOREIGN KEY (autor_id) REFERENCES autores(id)
);

CREATE TABLE IF NOT EXISTS personal_administrativo (
    id INTEGER PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    puesto VARCHAR(100) NOT NULL,
    fecha_contratacion DATE NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(255) UNIQUE,
    libro_id INTEGER,
    FOREIGN KEY (libro_id) REFERENCES libros(id)
);

CREATE TABLE IF NOT EXISTS prestamos (
    id INTEGER PRIMARY KEY,
    libro_id INTEGER,
    fecha_prestamo DATE NOT NULL,
    fecha_devolucion DATE,
    nombre_prestatario VARCHAR(255) NOT NULL,
    FOREIGN KEY (libro_id) REFERENCES libros(id)
);

