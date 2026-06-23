// server.js
// Servidor de Backend para Flash Delivery MVP

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const DB_FILE = path.join(__dirname, 'db.json');

// Middlewares
app.use(cors());
app.use(express.json());
// Servir archivos estáticos de la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Helpers para base de datos JSON
function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            return { users: {}, orders: [] };
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error al leer la base de datos:", error);
        return { users: {}, orders: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error("Error al escribir en la base de datos:", error);
    }
}

// --- ENDPOINTS DE AUTENTICACIÓN ---

// Registro de Usuario
app.post('/api/auth/register', (req, res) => {
    const { name, email, pass, role, photo, vehicle, plate } = req.body;
    
    if (!name || !email || !pass || !role || !photo) {
        return res.status(400).json({ error: "Faltan campos requeridos en el registro." });
    }
    
    const db = readDB();
    const emailKey = email.toLowerCase().trim();
    
    if (db.users[emailKey]) {
        return res.status(400).json({ error: "El correo electrónico ya está registrado." });
    }

    const newUser = {
        name,
        email: emailKey,
        pass,
        role,
        photo
    };

    if (role === 'Repartidor') {
        if (!vehicle || !plate) {
            return res.status(400).json({ error: "Los repartidores requieren vehículo y placa." });
        }
        newUser.vehicle = vehicle;
        newUser.plate = plate.toUpperCase();
        newUser.ratingSum = 5;
        newUser.ratingCount = 1;
    }

    db.users[emailKey] = newUser;
    writeDB(db);

    // Retornar usuario sin la contraseña
    const { pass: _, ...userWithoutPass } = newUser;
    res.status(201).json(userWithoutPass);
});

// Login de Usuario
app.post('/api/auth/login', (req, res) => {
    const { email, pass } = req.body;
    
    if (!email || !pass) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }

    const db = readDB();
    const emailKey = email.toLowerCase().trim();
    const user = db.users[emailKey];

    if (user && user.pass === pass) {
        const { pass: _, ...userWithoutPass } = user;
        return res.json(userWithoutPass);
    }

    res.status(401).json({ error: "Credenciales incorrectas." });
});


// --- ENDPOINTS DE ENTREGAS (ÚLTIMA MILLA) ---

// Crear un Pedido (Cliente)
app.post('/api/orders', (req, res) => {
    const { origin, destination, desc, distance, price, clientEmail } = req.body;

    if (!origin || !destination || !desc || !distance || !price || !clientEmail) {
        return res.status(400).json({ error: "Faltan datos del pedido." });
    }

    const db = readDB();
    
    // Validar si el cliente ya tiene una orden activa
    const hasActive = db.orders.find(o => o.clientEmail === clientEmail && o.status !== 'Finalizado');
    if (hasActive) {
        return res.status(400).json({ error: "Ya tienes un pedido activo en curso." });
    }

    const newOrder = {
        id: "ORD-" + Math.floor(100000 + Math.random() * 900000).toString(),
        origin,
        destination,
        desc,
        distance: parseFloat(distance),
        price: parseFloat(price),
        status: "Pendiente", // Pendiente, En camino, Entregado, Finalizado
        clientEmail,
        driverEmail: null,
        rating: null,
        createdAt: new Date().toISOString()
    };

    db.orders.push(newOrder);
    writeDB(db);

    res.status(201).json(newOrder);
});

// Obtener pedidos pendientes de la zona (Repartidor)
app.get('/api/orders/pending', (req, res) => {
    const db = readDB();
    const pending = db.orders.filter(o => o.status === 'Pendiente');
    res.json(pending);
});

// Obtener pedido activo de un usuario (Cliente o Repartidor)
app.get('/api/orders/active/:email/:role', (req, res) => {
    const { email, role } = req.params;
    const db = readDB();
    const emailKey = email.toLowerCase().trim();

    let activeOrder = null;
    if (role === 'Cliente') {
        activeOrder = db.orders.find(o => o.clientEmail === emailKey && o.status !== 'Finalizado');
    } else if (role === 'Repartidor') {
        activeOrder = db.orders.find(o => o.driverEmail === emailKey && o.status === 'En camino');
    }

    if (activeOrder) {
        // Enriquecer datos con perfiles
        const enriched = { ...activeOrder };
        if (activeOrder.driverEmail) {
            const driver = db.users[activeOrder.driverEmail];
            if (driver) {
                enriched.driverName = driver.name;
                enriched.driverPhoto = driver.photo;
                enriched.driverVehicle = driver.vehicle;
                enriched.driverPlate = driver.plate;
                enriched.driverRating = (driver.ratingSum / driver.ratingCount).toFixed(1);
            }
        }
        if (activeOrder.clientEmail) {
            const client = db.users[activeOrder.clientEmail];
            if (client) {
                enriched.clientName = client.name;
                enriched.clientPhoto = client.photo;
            }
        }
        return res.json(enriched);
    }

    res.json(null);
});

// Aceptar un pedido (Repartidor)
app.post('/api/orders/:id/accept', (req, res) => {
    const { id } = req.params;
    const { driverEmail } = req.body;

    if (!driverEmail) {
        return res.status(400).json({ error: "Se requiere el correo del repartidor." });
    }

    const db = readDB();
    const order = db.orders.find(o => o.id === id);

    if (!order) {
        return res.status(404).json({ error: "Pedido no encontrado." });
    }

    if (order.status !== 'Pendiente') {
        return res.status(400).json({ error: "El pedido ya no está disponible." });
    }

    // Verificar si el repartidor tiene pedidos activos
    const hasActive = db.orders.find(o => o.driverEmail === driverEmail && o.status === 'En camino');
    if (hasActive) {
        return res.status(400).json({ error: "Ya tienes una entrega activa en progreso." });
    }

    order.status = "En camino";
    order.driverEmail = driverEmail.toLowerCase().trim();
    writeDB(db);

    res.json(order);
});

// Marcar como entregado (Repartidor)
app.post('/api/orders/:id/complete', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const order = db.orders.find(o => o.id === id);

    if (!order) {
        return res.status(404).json({ error: "Pedido no encontrado." });
    }

    if (order.status !== 'En camino') {
        return res.status(400).json({ error: "El pedido no está en tránsito." });
    }

    order.status = "Entregado";
    writeDB(db);

    res.json(order);
});

// Calificar servicio del repartidor (Cliente)
app.post('/api/orders/:id/rate', (req, res) => {
    const { id } = req.params;
    const { rating } = req.body;

    const ratingVal = parseInt(rating);
    if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
        return res.status(400).json({ error: "Calificación inválida (debe ser 1 a 5)." });
    }

    const db = readDB();
    const order = db.orders.find(o => o.id === id);

    if (!order) {
        return res.status(404).json({ error: "Pedido no encontrado." });
    }

    if (order.status !== 'Entregado') {
        return res.status(400).json({ error: "El pedido no se ha entregado para calificar." });
    }

    order.status = "Finalizado";
    order.rating = ratingVal;

    // Actualizar reputación del repartidor
    const driverEmail = order.driverEmail;
    if (driverEmail && db.users[driverEmail]) {
        db.users[driverEmail].ratingSum += ratingVal;
        db.users[driverEmail].ratingCount += 1;
    }

    writeDB(db);
    res.json(order);
});

// --- ENDPOINTS DE SCRUM (DOCUMENTACIÓN) ---
app.get('/api/scrum/all', (req, res) => {
    const db = readDB();
    res.json({
        userStories: db.userStories || [],
        dailyStandups: db.dailyStandups || [],
        retrospective: db.retrospective || {}
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Flash Delivery MVP Backend corriendo en:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});
