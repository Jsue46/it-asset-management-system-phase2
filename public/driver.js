// public/driver.js
// Lógica del Portal del Repartidor

const API_BASE = '/api';
let activeDriver = null;
let activeDelivery = null;
let statusInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

function checkSession() {
    const session = sessionStorage.getItem('fd_active_driver');
    if (session) {
        activeDriver = JSON.parse(session);
        showDashboard();
    } else {
        showAuth();
    }
}

// Alternar login / registro
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

// Seleccionar avatar de repartidor
function selectAvatar(imgElement, avatarKey) {
    document.querySelectorAll('#registerForm .avatar-option').forEach(el => el.classList.remove('selected'));
    imgElement.classList.add('selected');
    document.getElementById('regPhoto').value = avatarKey;
}

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

    updateProfileUI();
    
    // Iniciar polling
    startDriverPolling();
}

function updateProfileUI() {
    if (!activeDriver) return;
    document.getElementById('profileDriverName').textContent = activeDriver.name;
    document.getElementById('profileDriverEmail').textContent = activeDriver.email;
    document.getElementById('profileAvatarPic').src = getAvatarUrl(activeDriver.photo);
    document.getElementById('profileVehicleTag').innerHTML = `<i class="fa-solid fa-${getVehicleIcon(activeDriver.vehicle)}"></i> ${activeDriver.vehicle} • Placa: ${activeDriver.plate}`;
    
    // Calcular reputación (si existe en los datos del backend, si no, consultar)
    fetchReputation();
}

async function fetchReputation() {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeDriver.email, pass: activeDriver.pass }) // Re-valida para recargar rating actual
        });
        if (res.ok) {
            const data = await res.json();
            activeDriver = data;
            sessionStorage.setItem('fd_active_driver', JSON.stringify(activeDriver));
            const avg = (activeDriver.ratingSum / activeDriver.ratingCount).toFixed(1);
            document.getElementById('profileRatingText').textContent = avg;
        }
    } catch (e) {
        console.error(e);
    }
}

function getAvatarUrl(key) {
    const seeds = {
        driver1: "https://api.dicebear.com/7.x/adventurer/svg?seed=Christian",
        driver2: "https://api.dicebear.com/7.x/adventurer/svg?seed=Owen",
        driver3: "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka"
    };
    return seeds[key] || "https://api.dicebear.com/7.x/adventurer/svg?seed=default";
}

function getVehicleIcon(vehicle) {
    if (vehicle === 'Bicicleta') return 'bicycle';
    if (vehicle === 'Automóvil') return 'car';
    return 'motorcycle';
}

function getClientAvatarUrl(key) {
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
    const vehicle = document.getElementById('regVehicle').value;
    const plate = document.getElementById('regPlate').value.trim().toUpperCase();
    const photo = document.getElementById('regPhoto').value;

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, pass, role: 'Repartidor', photo, vehicle, plate })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Error en registro.');
            return;
        }

        activeDriver = data;
        sessionStorage.setItem('fd_active_driver', JSON.stringify(activeDriver));
        document.getElementById('registerForm').reset();
        showDashboard();
        alert('¡Registro exitoso como repartidor! Sesión iniciada.');
    } catch (err) {
        console.error(err);
        alert('Error de conexión.');
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

        if (data.role !== 'Repartidor') {
            alert('Esta cuenta no está registrada como Repartidor.');
            return;
        }

        activeDriver = data;
        sessionStorage.setItem('fd_active_driver', JSON.stringify(activeDriver));
        showDashboard();
    } catch (err) {
        console.error(err);
        alert('Error de conexión.');
    }
}

// Logout
function handleLogout() {
    activeDriver = null;
    activeDelivery = null;
    sessionStorage.removeItem('fd_active_driver');
    showAuth();
}

// Polling
function startDriverPolling() {
    pollData();
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(pollData, 3000);
}

async function pollData() {
    if (!activeDriver) return;
    
    // 1. Consultar entrega activa
    try {
        const resActive = await fetch(`${API_BASE}/orders/active/${activeDriver.email}/Repartidor`);
        if (resActive.ok) {
            activeDelivery = await resActive.json();
            renderActiveDelivery();
        }
    } catch (err) {
        console.error("Error en polling activo:", err);
    }

    // 2. Si no hay entrega activa, consultar pendientes
    if (!activeDelivery) {
        try {
            const resPending = await fetch(`${API_BASE}/orders/pending`);
            if (resPending.ok) {
                const pendingOrders = await resPending.json();
                renderPendingOrders(pendingOrders);
            }
        } catch (err) {
            console.error("Error en polling pendientes:", err);
        }
    }
}

// Renderizar entrega en progreso
function renderActiveDelivery() {
    const noDeliveryMsg = document.getElementById('noActiveDeliveryMsg');
    const deliveryPanel = document.getElementById('activeDeliveryPanel');
    const availableCard = document.getElementById('cardAvailableOrders');

    if (!activeDelivery) {
        noDeliveryMsg.classList.remove('hidden');
        deliveryPanel.classList.add('hidden');
        availableCard.classList.remove('hidden');
        return;
    }

    // Ocultar zona de búsqueda para concentrarse en la entrega
    availableCard.classList.add('hidden');
    noDeliveryMsg.classList.add('hidden');
    deliveryPanel.classList.remove('hidden');

    // Inyectar datos
    document.getElementById('deliveryDescLabel').textContent = activeDelivery.desc;
    document.getElementById('deliveryOriginLabel').textContent = activeDelivery.origin;
    document.getElementById('deliveryDestLabel').textContent = activeDelivery.destination;
    document.getElementById('deliveryPriceLabel').textContent = `Q${activeDelivery.price.toFixed(2)}`;

    document.getElementById('clientNameLabel').textContent = activeDelivery.clientName;
    document.getElementById('clientAvatar').src = getClientAvatarUrl(activeDelivery.clientPhoto);
}

// Renderizar lista de pendientes
function renderPendingOrders(orders) {
    const container = document.getElementById('availableOrdersList');
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <i class="fa-solid fa-box-open"></i>
                No hay solicitudes de envíos pendientes en este momento.
            </div>`;
        return;
    }

    orders.forEach(o => {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-card-header">
                <h4>${o.desc}</h4>
                <span>Q${o.price.toFixed(2)}</span>
            </div>
            <div class="order-card-route">
                <div><i class="fa-solid fa-circle-dot" style="color: var(--secondary); margin-right: 4px;"></i> <strong>Recoger:</strong> ${o.origin}</div>
                <div><i class="fa-solid fa-location-dot" style="color: var(--primary); margin-right: 4px;"></i> <strong>Entregar:</strong> ${o.destination}</div>
            </div>
            <div class="order-card-footer">
                <small><i class="fa-solid fa-route"></i> Distancia: ${o.distance} km</small>
                <button class="accept-btn" onclick="acceptOrder('${o.id}')">Aceptar Pedido</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Aceptar Orden
async function acceptOrder(orderId) {
    if (!activeDriver) return;

    try {
        const res = await fetch(`${API_BASE}/orders/${orderId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverEmail: activeDriver.email })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Error al aceptar pedido.');
            return;
        }

        activeDelivery = data;
        renderActiveDelivery();
    } catch (err) {
        console.error(err);
        alert('Error al aceptar pedido.');
    }
}

// Completar Entrega
async function handleCompleteDelivery() {
    if (!activeDelivery) return;

    try {
        const res = await fetch(`${API_BASE}/orders/${activeDelivery.id}/complete`, {
            method: 'POST'
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Error al marcar como entregado.');
            return;
        }

        alert('¡Entrega completada! Esperando calificación del cliente.');
        activeDelivery = null;
        renderActiveDelivery();
        
        // Recargar perfil por si subió su reputación
        fetchReputation();
    } catch (err) {
        console.error(err);
        alert('Error al completar la entrega.');
    }
}
