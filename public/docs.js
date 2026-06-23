// public/docs.js
// Lógica para el Visualizador y Exportador de Documentación Scrum

const API_BASE = '/api';
let scrumData = {
    userStories: [],
    dailyStandups: [],
    retrospective: {}
};
let activeDailyIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    fetchScrumData();
});

// Obtener datos Scrum del backend
async function fetchScrumData() {
    try {
        const res = await fetch(`${API_BASE}/scrum/all`);
        if (!res.ok) {
            console.error("Error al obtener la documentación Scrum");
            return;
        }
        scrumData = await res.json();
        
        renderUserStories();
        renderDailyScrumTabs();
        switchDailyDay(0);
        renderRetrospective();
    } catch (e) {
        console.error("Error en conexión:", e);
    }
}

// Conmutador de Pestañas
function switchDocsTab(tabName) {
    document.querySelectorAll('.docs-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.docs-view').forEach(view => view.classList.remove('active'));

    if (tabName === 'stories') {
        document.getElementById('tabStories').classList.add('active');
        document.getElementById('viewStories').classList.add('active');
    } else if (tabName === 'ceremonies') {
        document.getElementById('tabCeremonies').classList.add('active');
        document.getElementById('viewCeremonies').classList.add('active');
    } else if (tabName === 'retrospective') {
        document.getElementById('tabRetro').classList.add('active');
        document.getElementById('viewRetro').classList.add('active');
    }
}

// Renderizar Historias de Usuario
function renderUserStories() {
    const tbody = document.getElementById('tblUserStoriesBody');
    tbody.innerHTML = '';

    scrumData.userStories.forEach(story => {
        const tr = document.createElement('tr');
        
        let critList = '<ul>';
        story.criteria.forEach(c => {
            critList += `<li><i class="fa-solid fa-square-check text-xs mr-1 text-accent" style="color: var(--secondary); margin-right: 4px;"></i> ${c}</li>`;
        });
        critList += '</ul>';

        tr.innerHTML = `
            <td><strong>${story.id}</strong></td>
            <td><span class="role-badge dev-badge" style="font-size:0.65rem">${story.epic}</span></td>
            <td style="font-weight: 500;">${story.story}</td>
            <td>${critList}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Renderizar Botones Daily Scrum
function renderDailyScrumTabs() {
    const nav = document.getElementById('dailyTabs');
    nav.innerHTML = '';

    scrumData.dailyStandups.forEach((d, idx) => {
        const btn = document.createElement('button');
        btn.className = `daily-tab-btn ${idx === activeDailyIndex ? 'active' : ''}`;
        btn.textContent = `Día ${idx + 1}`;
        btn.onclick = () => switchDailyDay(idx);
        nav.appendChild(btn);
    });
}

// Conmutar día del Daily
function switchDailyDay(index) {
    activeDailyIndex = index;
    const daily = scrumData.dailyStandups[index];
    if (!daily) return;

    // Actualizar botones
    const buttons = document.querySelectorAll('#dailyTabs .daily-tab-btn');
    buttons.forEach((btn, idx) => {
        if (idx === index) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    document.getElementById('lblDailyTitle').textContent = daily.day;
    document.getElementById('lblDailySummary').textContent = daily.summary;

    const chatBox = document.getElementById('lstDailyChat');
    chatBox.innerHTML = '';

    daily.chat.forEach(msg => {
        const isSM = msg.sender.includes('SM') || msg.sender.includes('Sergio');
        const color = isSM ? 'var(--primary)' : 'var(--secondary)';
        const avatarSeed = isSM ? 'Sergio' : (msg.sender.includes('CSS') ? 'Dev1' : 'Dev2');

        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';
        msgEl.innerHTML = `
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}" class="chat-avatar" alt="Avatar">
            <div class="chat-body">
                <div class="chat-sender" style="color: ${color}">${msg.sender}</div>
                <div class="chat-text">${msg.text}</div>
            </div>
        `;
        chatBox.appendChild(msgEl);
    });
}

// Renderizar Retrospectiva
function renderRetrospective() {
    const r = scrumData.retrospective;
    if (!r) return;

    // Well
    const lstWell = document.getElementById('lstRetroWell');
    lstWell.innerHTML = '';
    r.well.forEach(item => lstWell.innerHTML += `<li>${item}</li>`);

    // Bad
    const lstBad = document.getElementById('lstRetroBad');
    lstBad.innerHTML = '';
    r.bad.forEach(item => lstBad.innerHTML += `<li>${item}</li>`);

    // Improve
    const lstImprove = document.getElementById('lstRetroImprove');
    lstImprove.innerHTML = '';
    r.improve.forEach(item => lstImprove.innerHTML += `<li>${item}</li>`);
}

// Generador e Impresor de Reportes PDF
function triggerPrint() {
    const printContainer = document.getElementById('printReportContainer');
    printContainer.innerHTML = '';

    // Título Principal
    printContainer.innerHTML += `
        <div class="print-title-area">
            <h1>Reporte de Metodología Ágil (Sprint 1)</h1>
            <p>Flash Delivery - Proyecto de Entrega de Paquetes de Última Milla</p>
            <p><strong>Universidad de San Carlos de Guatemala</strong> • Teoría de Sistemas 2 • Grupo G7</p>
            <p><strong>Fecha de Generación:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
    `;

    // 1. Historias de Usuario
    let storiesRows = '';
    scrumData.userStories.forEach(s => {
        let criteriaList = '';
        s.criteria.forEach(c => criteriaList += `<li>${c}</li>`);
        storiesRows += `
            <tr>
                <td><strong>${s.id}</strong></td>
                <td><strong>${s.epic}</strong></td>
                <td>${s.story}</td>
                <td><ul>${criteriaList}</ul></td>
            </tr>
        `;
    });

    printContainer.innerHTML += `
        <div class="print-section">
            <h2>1. Historias de Usuario y Criterios de Aceptación</h2>
            <table class="print-table">
                <thead>
                    <tr>
                        <th style="width: 10%;">ID</th>
                        <th style="width: 25%;">Épica</th>
                        <th style="width: 35%;">Historia de Usuario</th>
                        <th style="width: 30%;">Criterios de Aceptación</th>
                    </tr>
                </thead>
                <tbody>
                    ${storiesRows}
                </tbody>
            </table>
        </div>
    `;

    // 2. Sprint Planning
    printContainer.innerHTML += `
        <div class="print-section" style="page-break-before: always;">
            <h2>2. Ceremonias de Sprint - Sprint Planning 1</h2>
            <div class="print-ceremonies-grid">
                <div class="print-ceremony-card">
                    <h3>Roles y Responsabilidades</h3>
                    <p><strong>Scrum Master:</strong> Sergio Andrés Larios Fajardo (Facilitador)</p>
                    <p><strong>Dev Team (CSS &amp; UX):</strong> Estudiante - Integrante G7 (A)</p>
                    <p><strong>Dev Team (Lógica &amp; API):</strong> Estudiante - Integrante G7 (B)</p>
                </div>
                <div class="print-ceremony-card" style="margin-top: 1rem;">
                    <h3>Objetivos del Sprint 1 (MVP)</h3>
                    <p>Construir los flujos mínimos necesarios para validar el negocio en tiempo real. Esto incluye: autenticación de usuarios, perfiles de repartidores, cálculo de tarifas automatizado (Km * Q5.00), match de entregas, seguimiento de trayectos y calificación final.</p>
                </div>
            </div>
        </div>
    `;

    // 3. Daily Scrums
    let dailyLogs = '';
    scrumData.dailyStandups.forEach(d => {
        let chatLines = '';
        d.chat.forEach(c => {
            chatLines += `
                <div class="print-chat-msg">
                    <strong>${c.sender}:</strong> "${c.text}"
                </div>
            `;
        });
        dailyLogs += `
            <div class="print-daily-log">
                <h4>${d.day}</h4>
                <p style="margin-bottom:0.4rem; font-size: 9pt;"><strong>Resumen:</strong> ${d.summary}</p>
                ${chatLines}
            </div>
        `;
    });

    printContainer.innerHTML += `
        <div class="print-section">
            <h2>3. Bitácora de Daily Scrum (Evidencias de Reuniones de 15 min)</h2>
            <p>Se detalla el registro y bitácora del Daily Scrum del equipo durante el transcurso del Sprint:</p>
            ${dailyLogs}
        </div>
    `;

    // 4. Retrospective
    let retroWell = '';
    scrumData.retrospective.well.forEach(w => retroWell += `<li>${w}</li>`);
    let retroBad = '';
    scrumData.retrospective.bad.forEach(b => retroBad += `<li>${b}</li>`);
    let retroImprove = '';
    scrumData.retrospective.improve.forEach(i => retroImprove += `<li>${i}</li>`);

    printContainer.innerHTML += `
        <div class="print-section" style="page-break-before: always;">
            <h2>4. Sprint Retrospective (Retrospectiva del Sprint 1)</h2>
            <div class="print-retro-grid">
                <div class="print-retro-card" style="border-top:3px solid #10b981;">
                    <h3>¿Qué salió bien?</h3>
                    <ul>${retroWell}</ul>
                </div>
                <div class="print-retro-card" style="border-top:3px solid #ef4444;">
                    <h3>¿Qué salió mal?</h3>
                    <ul>${retroBad}</ul>
                </div>
                <div class="print-retro-card" style="border-top:3px solid #06b6d4;">
                    <h3>¿Cómo mejorar?</h3>
                    <ul>${retroImprove}</ul>
                </div>
            </div>
        </div>
    `;

    // Disparar diálogo de impresión
    window.print();
}
