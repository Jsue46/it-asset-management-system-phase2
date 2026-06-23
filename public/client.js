// public/client.js
// Lógica del Portal del Cliente

const API_BASE = '/api';
let activeClient = null;
let activeOrder = null;
let activeRatingVal = 0;
let statusInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

function checkSession() {
    const session = sessionStorage.getItem('fd_active_client');
    if (session) {
        activeClient = JSON.parse(session);
        showDashboard();
    } else {
        showAuth();
    }
}

// Alternar entre login y registro
function setAuthTab(tab) {
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');

    if (tab === 'login') {
        document.getElementById('tabLogin').classList.add('active');
        document.getElementById('loginForm').classList.remove('hidden');
    } else {
        document.getElementById('tabRegister').classList.add('active');
        document.getElementById('registerForm').classList.remove('hidden');
    }
}

// Seleccionar Avatar en Registro
function selectAvatar(imgElement, avatarKey) {
    document.querySelectorAll('#registerForm .avatar-option').forEach(el => el.classList.remove('selected'));
    imgElement.classList.add('selected');
    document.getElementById('regPhoto').value = avatarKey;
}

// Mostrar pantallas
function showAuth() {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
}

function showDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    // Inyectar datos de cabecera/perfil
    document.getElementById('profileClientName').textContent = activeClient.name;
    document.getElementById('profileClientEmail').textContent = activeClient.email;
    document.getElementById('profileAvatarPic').src = getAvatarUrl(activeClient.photo);
    
    // Iniciar polling de estado de orden activa
    startOrderPolling();
}

function getAvatarUrl(key) {
    const seeds = {
        avatar1: "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
        avatar2: "https://api.dicebear.com/7.x/adventurer/svg?seed=Aria",
        avatar3: "https://api.dicebear.com/7.x/adventurer/svg?seed=Jack"
    };
    return seeds[key] || "https://api.dicebear.com/7.x/adventurer/svg?seed=default";
}

// Registro
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const pass = document.getElementById('regPass').value;
    const photo = document.getElementById('regPhoto').value;

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, pass, role: 'Cliente', photo })
        });
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || 'Error al registrarse.');
            return;
        }

        activeClient = data;
        sessionStorage.setItem('fd_active_client', JSON.stringify(activeClient));
        document.getElementById('registerForm').reset();
        showDashboard();
        alert('¡Registro exitoso! Sesión iniciada.');
    } catch (err) {
        console.error(err);
        alert('Error de conexión con el servidor.');
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pass = document.getElementById('loginPass').value;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, pass })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Credenciales incorrectas.');
            return;
        }

        if (data.role !== 'Cliente') {
            alert('Esta cuenta no está registrada como Cliente.');
            return;
        }

        activeClient = data;
        sessionStorage.setItem('fd_active_client', JSON.stringify(activeClient));
        showDashboard();
    } catch (err) {
        console.error(err);
        alert('Error de conexión con el servidor.');
    }
}

// Logout
function handleLogout() {
    activeClient = null;
    activeOrder = null;
    sessionStorage.removeItem('fd_active_client');
    showAuth();
}

// Tarifa base
function calculateFare(dist) {
    const distanceVal = parseFloat(dist) || 0;
    const baseFare = distanceVal * 5;
    document.getElementById('txtBasePrice').textContent = `Q${baseFare.toFixed(2)}`;
    // Sincronizar sugerido
    document.getElementById('orderPrice').value = Math.ceil(baseFare);
    document.getElementById('orderPrice').min = Math.ceil(baseFare);
}

// Crear Pedido
async function handleRequestOrder(e) {
    e.preventDefault();
    if (!activeClient) return;

    const origin = document.getElementById('orderOrigin').value.trim();
    const destination = document.getElementById('orderDestination').value.trim();
    const desc = document.getElementById('orderDesc').value.trim();
    const distance = parseFloat(document.getElementById('orderDistance').value);
    const price = parseFloat(document.getElementById('orderPrice').value);
    const baseFare = distance * 5;

    if (price < baseFare) {
        alert(`La tarifa ofrecida no puede ser menor al cálculo base de Q${baseFare.toFixed(2)}.`);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination, desc, distance, price, clientEmail: activeClient.email })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Error al procesar la solicitud.');
            return;
        }

        activeOrder = data;
        // Limpiar form
        document.getElementById('orderOrigin').value = "Avenida Reforma 12-45, Zona 10";
        document.getElementById('orderDestination').value = "Campus Central USAC, Edificio T-3, Zona 12";
        document.getElementById('orderDesc').value = "Laptop Dell y planos de Arquitectura";
        document.getElementById('orderDistance').value = "8";
        calculateFare(8);

        renderActiveOrderView();
    } catch (err) {
        console.error(err);
        alert('Error de conexión.');
    }
}

// Polling de Estado de Orden
function startOrderPolling() {
    pollActiveOrder(); // Primera llamada inmediata
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(pollActiveOrder, 3000); // Cada 3 segundos
}

async function pollActiveOrder() {
    if (!activeClient) return;
    try {
        const res = await fetch(`${API_BASE}/orders/active/${activeClient.email}/Cliente`);
        if (!res.ok) return;
        const data = await res.json();
        
        activeOrder = data;
        renderActiveOrderView();
    } catch (err) {
        console.error("Error en polling:", err);
    }
}

// Renderizar Vista de Orden Activa
function renderActiveOrderView() {
    const noOrderMsg = document.getElementById('noActiveOrderMsg');
    const orderPanel = document.getElementById('activeOrderPanel');
    const reqForm = document.getElementById('cardRequestForm');
    
    if (!activeOrder) {
        noOrderMsg.classList.remove('hidden');
        orderPanel.classList.add('hidden');
        reqForm.classList.remove('hidden');
        return;
    }

    // Ocultar formulario de creación para centrarse en la orden
    reqForm.classList.add('hidden');
    noOrderMsg.classList.add('hidden');
    orderPanel.classList.remove('hidden');

    // Inyectar datos generales
    document.getElementById('orderDescLabel').textContent = activeOrder.desc;
    document.getElementById('orderOriginLabel').textContent = activeOrder.origin;
    document.getElementById('orderDestLabel').textContent = activeOrder.destination;
    document.getElementById('orderPriceLabel').textContent = `Q${activeOrder.price.toFixed(2)}`;

    // Manejar indicador de pulso y textos
    const pulse = document.getElementById('orderPulse');
    const statusLabel = document.getElementById('orderStatusLabel');
    const driverBox = document.getElementById('driverBox');
    const ratingBox = document.getElementById('ratingBox');

    pulse.className = 'pulse-indicator';
    driverBox.classList.add('hidden');
    ratingBox.classList.add('hidden');

    if (activeOrder.status === 'Pendiente') {
        pulse.classList.add('searching');
        statusLabel.textContent = "Buscando Repartidor...";
    } else if (activeOrder.status === 'En camino') {
        pulse.classList.add('transit');
        statusLabel.textContent = "¡Repartidor en camino!";
        driverBox.classList.remove('hidden');

        // Cargar datos del repartidor asignado
        document.getElementById('driverNameLabel').textContent = activeOrder.driverName;
        document.getElementById('driverVehicleLabel').innerHTML = `<i class="fa-solid fa-motorcycle"></i> ${activeOrder.driverVehicle} • Placa: ${activeOrder.driverPlate}`;
        document.getElementById('driverRatingLabel').textContent = activeOrder.driverRating;
        document.getElementById('driverAvatar').src = getDriverAvatarUrl(activeOrder.driverPhoto);
    } else if (activeOrder.status === 'Entregado') {
        pulse.style.backgroundColor = 'var(--success)';
        statusLabel.textContent = "Paquete Entregado";
        ratingBox.classList.remove('hidden');
    }
}

function getDriverAvatarUrl(key) {
    const seeds = {
        driver1: "https://api.dicebear.com/7.x/adventurer/svg?seed=Christian",
        driver2: "https://api.dicebear.com/7.x/adventurer/svg?seed=Owen",
        driver3: "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka"
    };
    return seeds[key] || "https://api.dicebear.com/7.x/adventurer/svg?seed=default";
}

// Configurar Calificación
function setStarRating(val) {
    activeRatingVal = val;
    const stars = document.querySelectorAll('#starSelector i');
    stars.forEach((star, index) => {
        if (index < val) {
            star.className = 'fa-solid fa-star active';
        } else {
            star.className = 'fa-regular fa-star';
        }
    });
}

function resetStars() {
    activeRatingVal = 0;
    document.querySelectorAll('#starSelector i').forEach(star => {
        star.className = 'fa-regular fa-star';
    });
}

// Enviar Calificación
async function submitRating() {
    if (!activeOrder || activeOrder.status !== 'Entregado') return;

    if (activeRatingVal === 0) {
        alert('Por favor selecciona una valoración en estrellas.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: activeRatingVal })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Error al calificar.');
            return;
        }

        alert('¡Muchas gracias por calificar el servicio! Envío finalizado con éxito.');
        activeOrder = null;
        resetStars();
        renderActiveOrderView();
    } catch (err) {
        console.error(err);
        alert('Error al calificar.');
    }
}
